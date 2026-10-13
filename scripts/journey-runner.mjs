/**
 * Харнесс для сценариев пользователя: тонкая обёртка над CDP.
 *
 * Зачем он такой, а не готовый инструмент: приложение — это SPA без
 * data-testid, поэтому искать элементы приходится по aria-label, role и
 * точному русскому тексту. Своя обёртка это умеет и вдобавок перехватывает
 * ошибки страницы и диалоги браузера, из-за которых сценарий встал бы молча.
 *
 * Запуск:
 *   node scripts/journey-runner.mjs                    # все сценарии на живом сайте
 *   node scripts/journey-runner.mjs --base=http://127.0.0.1:4173
 *   node scripts/journey-runner.mjs --only=привычки    # подмножество по имени
 *   node scripts/journey-runner.mjs --mobile           # узкий экран, нижнее меню
 *   node scripts/journey-runner.mjs --keep-open        # не закрывать браузер
 *
 * Браузер: Яндекс.Браузер, порт 9225, отдельный профиль. Сам он не
 * запускается — поднимите его так:
 *   "C:\Program Files\Yandex\YandexBrowser\Application\browser.exe" ^
 *     --remote-debugging-port=9225 --headless=new --user-data-dir=%TEMP%\momentum-cdp
 */

import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { scenarios } from './journeys.mjs'

const CDP_PORT = Number(process.env.MOMENTUM_CDP_PORT ?? 9225)
const TMP_DIR = process.env.TEMP ?? tmpdir()
const SHOT_DIR = join(TMP_DIR, 'momentum-journey-shots')

/* ------------------------------------------------------------------ CDP --- */

class Cdp {
  #ws
  #id = 0
  #pending = new Map()
  #handlers = new Map()

  static async connect(port) {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`)
    const { webSocketDebuggerUrl } = await res.json()
    const cdp = new Cdp()
    cdp.#ws = new WebSocket(webSocketDebuggerUrl)
    await new Promise((ok, bad) => {
      cdp.#ws.addEventListener('open', ok, { once: true })
      cdp.#ws.addEventListener('error', () => bad(new Error('CDP: не соединился')), { once: true })
    })
    cdp.#ws.addEventListener('message', (ev) => cdp.#onMessage(ev.data))
    return cdp
  }

  #onMessage(raw) {
    const msg = JSON.parse(raw)
    if (msg.id !== undefined) {
      const p = this.#pending.get(msg.id)
      if (!p) return
      this.#pending.delete(msg.id)
      if (msg.error) p.reject(new Error(`${msg.error.message} (${msg.method ?? ''})`))
      else p.resolve(msg.result)
      return
    }
    for (const h of this.#handlers.get(msg.method) ?? []) h(msg.params, msg.sessionId)
  }

  send(method, params = {}, sessionId) {
    const id = ++this.#id
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject })
      this.#ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
      setTimeout(() => {
        if (!this.#pending.has(id)) return
        this.#pending.delete(id)
        reject(new Error(`CDP: таймаут ${method}`))
      }, 30_000)
    })
  }

  on(method, fn) {
    if (!this.#handlers.has(method)) this.#handlers.set(method, [])
    this.#handlers.get(method).push(fn)
  }

  close() {
    this.#ws.close()
  }
}

/* --------------------------------------------------- страница и сценарий --- */

class Check {
  constructor() {
    this.rows = []
  }
  ok(cond, msg) {
    this.rows.push({ pass: !!cond, msg })
    if (!cond) throw new Error(`ПРОВАЛ: ${msg}`)
    return !!cond
  }
  eq(actual, expected, msg) {
    const same = String(actual).trim() === String(expected).trim()
    this.rows.push({ pass: same, msg: `${msg} (получено ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)})` })
    if (!same) throw new Error(`ПРОВАЛ: ${msg} — получено ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`)
    return same
  }
  /**
   * Ищет текст на странице без учёта регистра и переносов строк.
   *
   * Регистр: innerText отдаёт «ИТОГИ» там, где в разметке «Итоги» (текст
   * поднят в верхний регистр через CSS) — это оформление, а не содержание.
   * Переносы: на узком экране «1 из 4 сегодня» переносится на две строки, и
   * innerText ставит между словами перевод строки — тоже оформление.
   */
  contains(hay, needle, msg) {
    const flat = (v) => String(v).toLowerCase().replace(/\s+/g, ' ')
    const has = flat(hay).includes(flat(needle))
    this.rows.push({ pass: has, msg: `${msg} (в ${JSON.stringify(String(hay).slice(0, 120))} нет ${JSON.stringify(needle)})` })
    if (!has) throw new Error(`ПРОВАЛ: ${msg} — нет ${JSON.stringify(needle)}`)
    return has
  }
}

class Dialog {
  constructor(cdp, sessionId) {
    this.cdp = cdp
    this.sessionId = sessionId
    this.mode = 'accept'
    this.seen = 0
    cdp.on('Page.javascriptDialogOpening', async (p, sid) => {
      if (sid !== sessionId) return
      this.seen++
      await cdp.send('Page.handleJavaScriptDialog', { accept: this.mode === 'accept' }, sid).catch(() => {})
    })
  }
}

class Page {
  constructor(cdp, sessionId, base) {
    this.cdp = cdp
    this.sessionId = sessionId
    this.base = base
    this.check = new Check()
    this.dialog = new Dialog(cdp, sessionId)
    this.errors = []
    this.warnings = []
    this.currentStep = '(старт)'
    this.console = []
  }

  get session() {
    return this.sessionId
  }

  /* низкий уровень */
  async send(method, params) {
    return this.cdp.send(method, params, this.sessionId)
  }

  async eval(fn, ...args) {
    // Точка тонкая: если написать `(${src})(...args)` на двух строках, между
    // ними вставляется точка с запятой, и страница выполняет «функцию», а потом
    // пытается вызвать её же как результат. Поэтому .call() прижат к скобке
    // функции на той же строке — переносов между ними не возникает.
    const expression = `(function () { return (${fn.toString()}).call(null, ...${JSON.stringify(args)}) })()`
    if (process.env.MOMENTUM_DEBUG_EVAL) {
      console.log(`--- выражение ---\n${expression}\n--- вызов ---\n`)
    }
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    })
    if (res.exceptionDetails) {
      throw new Error(`Страница бросила: ${res.exceptionDetails.exception?.description ?? res.exceptionDetails.text}`)
    }
    return res.result.value
  }

  /** Код, исполняемый в контексте страницы. Параметры — только сериализуемые. */
  code(source) {
    return this.eval(new Function(`return (${source})`)())
  }

  /* проверки: живут на самой странице, чтобы сценарий читался как список ожиданий */
  ok(cond, msg) {
    return this.check.ok(cond, msg)
  }
  eq(actual, expected, msg) {
    return this.check.eq(actual, expected, msg)
  }
  contains(hay, needle, msg) {
    return this.check.contains(hay, needle, msg)
  }

  /* ожидание */
  async waitFor(sel, { timeout = 8000, opts = {}, label } = {}) {
    const until = Date.now() + timeout
    const what = label ?? sel
    for (;;) {
      const n = await this.eval(Q_ALL, sel, opts)
      if (n.length) return n
      if (Date.now() > until) {
        // Разведка падения: что на самом деле есть в DOM под этим селектором.
        if (process.env.JOURNEY_DEBUG) {
          const plain = plainSelector(sel)
          const raw = await this.eval(
            `(sel) => Array.from(document.querySelectorAll(sel)).map((e) => ({ tag: e.tagName, text: (e.innerText || '').replace(/\\s+/g, ' ').slice(0, 60), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) }))`,
            plain,
          )
          const toasts = await this.eval(
            `() => Array.from(document.querySelectorAll('[data-sonner-toast]')).map((e) => (e.innerText || '').replace(/\\s+/g, ' '))`,
          )
          console.error(`[разведка] не дождался «${what}»`)
          console.error(`[разведка] сырой запрос ${plain} дал: ${JSON.stringify(raw)}`)
          console.error(`[разведка] тосты на экране: ${JSON.stringify(toasts)}`)
          console.error(
            `[разведка] текст страницы: ${JSON.stringify(String(await this.eval('() => document.body.innerText')).replace(/\s+/g, ' ').slice(0, 600))}`,
          )
          console.error(
            `[разведка] кнопки «На завтра»: ${JSON.stringify(await this.eval(`() => Array.from(document.querySelectorAll('button')).filter((b) => (b.innerText || '').trim().includes('завтра')).map((b) => { const r = b.getBoundingClientRect(); return { text: b.innerText.trim(), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] } })`))}`,
          )
        }
        throw new Error(`Не дождался: ${what}`)
      }
      await this.sleep(90)
    }
  }

  async waitGone(sel, { timeout = 8000, opts = {}, label } = {}) {
    const until = Date.now() + timeout
    for (;;) {
      const n = await this.eval(Q_ALL, sel, opts)
      if (!n.length) return true
      if (Date.now() > until) throw new Error(`Не исчезло: ${label ?? sel}`)
      await this.sleep(90)
    }
  }

  async sleep(ms) {
    await new Promise((r) => setTimeout(r, ms))
  }

  /** Открытие приложения с нуля: сброс данных и перезагрузка. */
  async open({ path = '/', fresh = true, waitSplash = true } = {}) {
    await this.send('Page.navigate', { url: this.base + path })
    await this.waitReady({ waitSplash })
    if (fresh) {
      await this.eval(FRESH)
      await this.send('Page.reload', { ignoreCache: false })
      await this.waitReady({ waitSplash })
    }
  }

  async waitReady({ waitSplash = true } = {}) {
    const until = Date.now() + 25_000
    for (;;) {
      const ready = await this.eval(READY)
      if (ready && (!waitSplash || !ready.splash)) return ready
      if (Date.now() > until) throw new Error('Страница не поднялась (нет #root или висит заставка)')
      await this.sleep(150)
    }
  }

  /* поиск элементов */
  async find(sel, opts = {}) {
    return this.eval(Q_ALL, sel, opts)
  }
  async exists(sel, opts = {}) {
    return (await this.find(sel, opts)).length > 0
  }
  /** Значение одного атрибута первого найденного элемента. */
  async attr(sel, name, opts = {}) {
    return this.eval(
      `(sel, name, opts) => {
        const found = (function () {
          const parts = String(sel).split('||')
          const out = []
          for (const raw of parts) {
            let part = raw.trim()
            if (!part) continue
            const tRe = part.match(/:text-is\\((.*)\\)\\s*$/)
            if (tRe) part = part.slice(0, tRe.index).trim()
            const cRe = part.match(/:text-contains\\((.*)\\)\\s*$/)
            if (cRe) part = part.slice(0, cRe.index).trim()
            const nRe = part.match(/:nth\\((-?\\d+)\\)\\s*$/)
            if (nRe) part = part.slice(0, nRe.index).trim()
            const dRe = part.match(/:h2-is\\((.*)\\)\\s*$/)
            if (dRe) part = part.slice(0, dRe.index).trim()
            let list = part ? Array.from(document.querySelectorAll(part)) : []
            if (tRe) list = list.filter((e) => (e.innerText || '').trim() === tRe[1].trim().replace(/^["']|["']$/g, ''))
            if (cRe) list = list.filter((e) => (e.innerText || '').includes(cRe[1].trim().replace(/^["']|["']$/g, '')))
            if (dRe) list = list.filter((e) => { const h = e.querySelector('h2'); return !!h && (h.innerText || '').trim() === dRe[1].trim().replace(/^["']|["']$/g, '') })
            out.push(...list)
          }
          return out
        })()
        if (!found.length) return null
        const idx = opts && typeof opts.nth === 'number' ? opts.nth : 0
        const el = found[idx]
        return el ? el.getAttribute(name) : null
      }`,
      sel,
      name,
      opts,
    )
  }
  async count(sel, opts = {}) {
    return (await this.find(sel, opts)).length
  }
  async textOf(sel, opts = {}) {
    const found = await this.find(sel, opts)
    return found.length ? found[0].text : null
  }
  async allText(sel, opts = {}) {
    return (await this.find(sel, opts)).map((e) => e.text)
  }
  /** Весь видимый текст страницы целиком — без обрезки до 200 символов. */
  async bodyText() {
    return this.eval(`() => document.body.innerText`)
  }
  /**
   * Полный текст элемента. textOf обрезает подпись до 200 символов, а в
   * диалогах нужные слова прячутся ниже — поэтому читаем целиком.
   */
  async textFull(sel, opts = {}) {
    return this.eval(RESOLVE_TEXT, sel, opts)
  }

  /* действия */
  /** Прокрутить элемент в середину экрана: координаты ниже считаются от видимой области. */
  async scrollTo(sel, opts = {}) {
    return this.eval(SCROLL_TO, sel, opts)
  }

  /** Элементы, найденные своим кодом в странице, — когда селектора не хватает. */
  async geoBy(fnSource, ...args) {
    return this.eval(GEO_BY, fnSource, args)
  }

  async click(sel, opts = {}, { clickCount = 1, force = false } = {}) {
    await this.scrollTo(sel, opts)
    const found = await this.find(sel, opts)
    if (!found.length) {
      if (process.env.JOURNEY_DEBUG) {
        const plain = plainSelector(sel)
        const raw = await this.eval(
          `(sel) => Array.from(document.querySelectorAll(sel)).map((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return { tag: e.tagName, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], display: s.display, visibility: s.visibility, opacity: s.opacity } })`,
          plain,
        )
        console.error(`[разведка] нечего кликать: ${sel}`)
        console.error(`[разведка] сырой запрос ${plain} дал ${raw.length}: ${JSON.stringify(raw)}`)
        console.error(`[разведка] окно: ${await this.eval('() => `${innerWidth}x${innerHeight}, scrollY=${scrollY}`')}`)
        console.error(`[разведка] заголовок: ${JSON.stringify(await this.eval(`() => Array.from(document.querySelectorAll('h1')).map((h) => h.innerText)`))}`)
      }
      throw new Error(`Нечего кликать: ${sel}${describeOpts(opts)}`)
    }
    const el = found[0]
    if (!el.visible && !force) throw new Error(`Не видно: ${sel}${describeOpts(opts)} — «${el.text.slice(0, 40)}»`)
    if (el.disabled) throw new Error(`Элемент выключен: ${sel}${describeOpts(opts)} — «${el.text.slice(0, 40)}»`)
    const pt = el.clickable ?? { x: el.x, y: el.y }
    for (let i = 0; i < clickCount; i++) {
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y, buttons: 0 })
      await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', buttons: 1, clickCount: i + 1 })
      await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', buttons: 0, clickCount: i + 1 })
    }
    await this.sleep(120)
    return el
  }

  async dblclick(sel, opts = {}) {
    return this.click(sel, opts, { clickCount: 2 })
  }

  /** Клик по элементу, найденному своим кодом (см. geoBy). */
  async clickBox(box, { clickCount = 1, scroll = true } = {}) {
    if (!box) throw new Error('Кликать не по чему: элемент не найден')
    if (scroll && (box.rect.y < 0 || box.rect.y + box.rect.h > 900)) {
      await this.eval(SCROLL_BY, box.rect.y - 300)
      await this.sleep(120)
    }
    for (let i = 0; i < clickCount; i++) {
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y, buttons: 0 })
      await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: i + 1 })
      await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', buttons: 0, clickCount: i + 1 })
    }
    await this.sleep(140)
    return box
  }

  /**
   * Набор текста в поле как у человека: сначала всё выделяется, затем
   * печатается. Нужен там, где поле предзаполнено (новое упражнение
   * приходит со словом «Новое упражнение») — иначе набор дописывает
   * свой текст в конец, и получается «Новое упражнениеЖим лёжа».
   */
  async typeInto(sel, text, opts = {}) {
    await this.click(sel, opts)
    await this.eval(SELECT_ALL, sel, opts)
    await this.type(text)
    return text
  }

  /** Набор текста настоящими клавишами — так приложение понимает ввод. */
  async type(text, { delay = 45 } = {}) {
    for (const ch of String(text)) {
      const k = keyFor(ch)
      const base = {
        key: k.key,
        code: k.code,
        text: ch,
        unmodifiedText: ch,
        windowsVirtualKeyCode: k.vk,
        nativeVirtualKeyCode: k.vk,
        modifiers: k.shift ? 8 : 0,
      }
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base })
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...{ ...base, text: undefined, unmodifiedText: undefined } })
      await this.sleep(delay)
    }
  }

  async hover(sel, opts = {}) {
    const found = await this.find(sel, opts)
    if (!found.length) throw new Error(`Нечего наводить: ${sel}`)
    const { x, y } = found[0]
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 })
    await this.sleep(150)
  }

  /**
   * Ввод текста в поле. Enter здесь намеренно не жмём: в форме привычки он
   * отправляет форму и закрывает окно, а в быстром добавлении пункта плана —
   * добавляет пункт сам. Сценарий сам решает, когда нажать кнопку.
   */
  async fill(sel, value, opts = {}) {
    await this.click(sel, opts)
    await this.eval(SET_VALUE, sel, opts, String(value))
    return value
  }

  async press(key, { modifiers = 0 } = {}) {
    const map = {
      Enter: { code: 'Enter', keyCode: 13, text: '\r' },
      Tab: { code: 'Tab', keyCode: 9 },
      Escape: { code: 'Escape', keyCode: 27 },
      Backspace: { code: 'Backspace', keyCode: 8 },
      Delete: { code: 'Delete', keyCode: 46 },
      ArrowDown: { code: 'ArrowDown', keyCode: 40 },
      ArrowUp: { code: 'ArrowUp', keyCode: 38 },
      ArrowRight: { code: 'ArrowRight', keyCode: 39 },
      ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
    }
    if (key === 'Control+z' || key === 'Control+я') {
      for (const type of ['keyDown', 'keyUp']) {
        await this.send('Input.dispatchKeyEvent', { type, modifiers: 2, key: key === 'Control+я' ? 'я' : 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, nativeVirtualKeyCode: 90 })
      }
      await this.sleep(150)
      return
    }
    const m = map[key]
    if (!m) throw new Error(`Клавиша не описана: ${key}`)
    const common = { key, code: m.code, windowsVirtualKeyCode: m.keyCode, nativeVirtualKeyCode: m.keyCode, modifiers }
    await this.send('Input.dispatchKeyEvent', { type: m.text ? 'keyDown' : 'rawKeyDown', ...common, text: m.text, ...(m.text ? {} : {}) })
    if (m.text) await this.send('Input.dispatchKeyEvent', { type: 'char', ...common, text: m.text })
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...common })
    await this.sleep(120)
  }

  async acceptDialog(mode = 'accept') {
    this.dialog.mode = mode
  }

  /** Файл во временную папку — чтобы подложить его в input[type=file]. */
  writeTemp(name, content) {
    const dir = join(TMP_DIR, 'journey-files')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const file = join(dir, name)
    writeFileSync(file, content, 'utf8')
    return file
  }

  /** Подложить файл в поле выбора: input скрыт, поэтому клик не годится. */
  async setFileInput(sel, files) {
    const doc = await this.send('DOM.getDocument', { depth: -1 })
    const found = await this.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: plainSelector(sel) })
    if (!found.nodeId) throw new Error(`Нет поля файла: ${sel}`)
    await this.send('DOM.setFileInputFiles', { files, nodeId: found.nodeId })
    await this.sleep(150)
  }

  /**
   * Приготовить папку загрузок ДО нажатия кнопки.
   * Браузер отменяет загрузку, если каталог не задан заранее: к моменту,
   * когда файл появляется, отменять уже поздно.
   */
  async armDownloads() {
    const dir = join(TMP_DIR, 'journey-downloads')
    if (existsSync(dir)) for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true })
    else mkdirSync(dir, { recursive: true })
    // Путь обязан быть в стиле Windows: со слэшами Chromium загрузку отменяет.
    await this.cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir, eventsEnabled: true })
    return dir
  }

  /**
   * Ждать, пока в папке появится и допишется файл. Возвращает путь или null.
   */
  async waitForDownload(dir, timeout = 10000) {
    const until = Date.now() + timeout
    for (;;) {
      const files = readdirSync(dir).filter((f) => !f.endsWith('.crdownload'))
      if (files.length) {
        const full = join(dir, files[0])
        // Ждём, пока размер перестанет меняться: файл ещё пишется.
        let last = -1
        for (;;) {
          const size = statSync(full).size
          if (size === last && size > 0) return full
          last = size
          if (Date.now() > until) return full
          await this.sleep(150)
        }
      }
      if (Date.now() > until) return null
      await this.sleep(200)
    }
  }

  /**
   * Нажать кнопку, которая отдаёт файл ссылкой с download, и дождаться файла.
   */
  async exportFile(sel, timeout = 10000) {
    const dir = await this.armDownloads()
    await this.click(sel)
    return this.waitForDownload(dir, timeout)
  }

  /** Экспорт бэкапа: вооружить папку, нажать «Экспорт · JSON» и дождаться файла. */
  async exportBackup() {
    const dir = await this.armDownloads()
    await this.click('button:text-is("Экспорт · JSON")')
    return this.waitForDownload(dir)
  }

  /** Скриншот — доказательство, если сценарий упал на разметке. */
  async shot(name) {
    if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true })
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' })
    const file = join(SHOT_DIR, `${name}.png`)
    writeFileSync(file, Buffer.from(data, 'base64'))
    return file
  }

  /* вспомогательное для сценариев */
  async step(name) {
    this.currentStep = name
    process.stdout.write(`    · ${name}\n`)
  }

  /** Сколько всего данных в приложении — грубый, но честный слепок. */
  async snapshot() {
    return this.eval(COUNTS)
  }

  async toast(sel, opts = {}) {
    return this.textOf(sel, opts)
  }
}

/* ------------------------------------------------ код, исполняемый в стр. --- */

/**
 * Полный текст элемента по селектору с псевдоэлементами.
 * Разбор селектора тот же, что в Q_ALL, иначе `[data-sonner-toast]:text-contains(…)`
 * прочитал бы первый тост на экране, а не тот, который искали.
 */
const RESOLVE_TEXT = `(sel, opts) => {
  opts = opts || {}
  const txt = (e) => (e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim()
  const found = []
  for (const raw of String(sel).split('||')) {
    let part = raw.trim()
    if (!part) continue
    const cRe = part.match(/:text-contains\\((.*)\\)\\s*$/)
    if (cRe) part = part.slice(0, cRe.index).trim()
    const tRe = part.match(/:text-is\\((.*)\\)\\s*$/)
    if (tRe) part = part.slice(0, tRe.index).trim()
    const nRe = part.match(/:nth\\((-?\\d+)\\)\\s*$/)
    if (nRe) part = part.slice(0, nRe.index).trim()
    const dRe = part.match(/:h2-is\\((.*)\\)\\s*$/)
    if (dRe) part = part.slice(0, dRe.index).trim()
    let list = []
    try { list = part ? Array.from(document.querySelectorAll(part)) : Array.from(document.body.querySelectorAll('*')) }
    catch (e) { list = [] }
    if (dRe) {
      const want = dRe[1].trim().replace(/^["']|["']$/g, '')
      list = list.filter((e) => { const h = e.querySelector('h2'); return !!h && txt(h) === want })
    }
    if (tRe) {
      const want = tRe[1].trim().replace(/^["']|["']$/g, '')
      list = list.filter((e) => txt(e) === want)
    }
    if (cRe) {
      const want = cRe[1].trim().replace(/^["']|["']$/g, '')
      list = list.filter((e) => txt(e).includes(want))
    }
    found.push(...list)
  }
  const idx = typeof opts.nth === 'number' ? opts.nth : 0
  const el = found[idx]
  return el ? el.innerText || el.textContent || '' : ''
}`

/** Поиск по селектору с псевдоэлементами :text-is / :text-contains / :nth. */
const Q_ALL = `(sel, opts) => {
  opts = opts || {}
  const visible = (e) => {
    const r = e.getBoundingClientRect()
    if (!r.width || !r.height) return false
    const s = getComputedStyle(e)
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'
  }
  const txt = (e) => (e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim()
  let parts = String(sel).split('||')
  const out = []
  for (const raw of parts) {
    let part = raw.trim()
    if (!part) continue
    const cRe = part.match(/:text-contains\\((.*)\\)\\s*$/)
    if (cRe) { part = part.slice(0, cRe.index).trim(); }
    const tRe = part.match(/:text-is\\((.*)\\)\\s*$/)
    if (tRe) { part = part.slice(0, tRe.index).trim(); }
    const nRe = part.match(/:nth\\((-?\\d+)\\)\\s*$/)
    if (nRe) { part = part.slice(0, nRe.index).trim(); }
    const dRe = part.match(/:h2-is\\((.*)\\)\\s*$/)
    if (dRe) { part = part.slice(0, dRe.index).trim(); }
    let nodes = []
    try { nodes = part ? Array.from(document.querySelectorAll(part)) : Array.from(document.body.querySelectorAll('*')) }
    catch (e) { nodes = [] }
    let list = nodes.filter((e) => (opts.hidden ? true : visible(e)))
    if (dRe) {
      // У диалога с заголовком aria-label не ставится, опознаём по h2 внутри.
      const want = dRe[1].trim().replace(/^["']|["']$/g, '')
      list = list.filter((e) => { const h = e.querySelector('h2'); return !!h && txt(h) === want })
    }
    if (tRe) {
      const want = tRe[1].trim().replace(/^["']|["']$/g, '')
      list = list.filter((e) => txt(e) === want)
    }
    if (cRe) {
      const want = cRe[1].trim().replace(/^["']|["']$/g, '')
      list = list.filter((e) => txt(e).includes(want))
    }
    for (const e of list) {
      const r = e.getBoundingClientRect()
      const cr = e.firstElementChild ? e.firstElementChild.getBoundingClientRect() : null
      const useInner = cr && cr.width && cr.height &&
        cr.left >= r.left - 1 && cr.right <= r.right + 1 && cr.top >= r.top - 1 && cr.bottom <= r.bottom + 1
      const target = useInner ? e.firstElementChild : e
      const tr = target.getBoundingClientRect()
      out.push({
        tag: e.tagName.toLowerCase(),
        text: txt(e).slice(0, 200),
        x: Math.round(tr.left + tr.width / 2),
        y: Math.round(tr.top + tr.height / 2),
        disabled: e.disabled === true || e.getAttribute('aria-disabled') === 'true',
        visible: visible(e),
        rect: { x: Math.round(tr.left), y: Math.round(tr.top), w: Math.round(tr.width), h: Math.round(tr.height) },
      })
    }
  }
  if (typeof opts.nth === 'number') return opts.nth >= 0 && opts.nth < out.length ? [out[opts.nth]] : []
  return out
}`

/**
 * Раскладка клавиатуры: символ → код клавиши, виртуальный код и нужен ли Shift.
 * Без этого браузер теряет символы вроде «(» и «:» — они приходят с чужим
 * кодом клавиши, и страница их не вставляет. Проверено: с этой таблицей
 * в поле уходит ровно набранная строка.
 */
const KEYMAP = {
  '(': ['Digit9', 57, true],
  ')': ['Digit0', 48, true],
  '"': ['Quote', 222, true],
  "'": ['Quote', 222, false],
  '=': ['Equal', 187, false],
  ':': ['Semicolon', 186, true],
  ';': ['Semicolon', 186, false],
  '*': ['Digit8', 56, true],
  '+': ['Equal', 187, true],
  '-': ['Minus', 189, false],
  '.': ['Period', 190, false],
  ',': ['Comma', 188, false],
  '/': ['Slash', 191, false],
  '?': ['Slash', 191, true],
  '!': ['Digit1', 49, true],
  '%': ['Digit5', 53, true],
  '&': ['Digit7', 55, true],
  '#': ['Digit3', 51, true],
  '<': ['Comma', 188, true],
  '>': ['Period', 190, true],
  '[': ['BracketLeft', 219, false],
  ']': ['BracketRight', 221, false],
  '{': ['BracketLeft', 219, true],
  '}': ['BracketRight', 221, true],
  '\\': ['Backslash', 220, false],
  '|': ['Backslash', 220, true],
  '~': ['Backquote', 192, true],
  '`': ['Backquote', 192, false],
  ' ': ['Space', 32, false],
}

function keyFor(ch) {
  const mapped = KEYMAP[ch]
  if (mapped) return { key: ch, code: mapped[0], vk: mapped[1], shift: mapped[2] }
  if (/[a-zA-Zа-яА-Я]/.test(ch)) {
    const upper = ch.toUpperCase()
    return { key: ch, code: 'Key' + upper, vk: upper.charCodeAt(0), shift: upper !== ch }
  }
  if (/[0-9]/.test(ch)) return { key: ch, code: 'Digit' + ch, vk: ch.charCodeAt(0), shift: false }
  return { key: ch, code: 'Unidentified', vk: ch.toUpperCase().charCodeAt(0), shift: false }
}

/** Выделить содержимое поле целиком, как Ctrl+A в настоящем поле ввода. */
const SELECT_ALL = `(sel, opts) => {
  const nodes = Array.from(document.querySelectorAll(sel))
  const el = nodes[(opts && opts.nth) || 0]
  if (!el) return false
  el.focus()
  el.select()
  if (typeof el.setSelectionRange === 'function') el.setSelectionRange(0, String(el.value || '').length)
  return true
}`

/** Прокрутка страницы на нужную высоту — для клика по своему найденному элементу. */
const SCROLL_BY = `(y) => { window.scrollBy({ top: y, behavior: 'instant' }); return window.scrollY }`

/**
 * Прокрутка к элементу перед кликом: иначе координата уходит за экран.
 *
 * Здесь селектор разбирается теми же правилами, что и в Q_ALL: если отдать
 * querySelectorAll огрызок без :text-is, отыщется совсем не та кнопка —
 * прокрутка уедет и нужная цель уйдёт за верхний край.
 */
const SCROLL_TO = `(sel, opts) => {
  opts = opts || {}
  const txt = (e) => (e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim()
  const found = []
  for (const raw of String(sel).split('||')) {
    let part = raw.trim()
    if (!part) continue
    const cRe = part.match(/:text-contains\\((.*)\\)\\s*$/)
    if (cRe) part = part.slice(0, cRe.index).trim()
    const tRe = part.match(/:text-is\\((.*)\\)\\s*$/)
    if (tRe) part = part.slice(0, tRe.index).trim()
    const nRe = part.match(/:nth\\((-?\\d+)\\)\\s*$/)
    if (nRe) part = part.slice(0, nRe.index).trim()
    const dRe = part.match(/:h2-is\\((.*)\\)\\s*$/)
    if (dRe) part = part.slice(0, dRe.index).trim()
    let list = []
    try { list = part ? Array.from(document.querySelectorAll(part)) : Array.from(document.body.querySelectorAll('*')) }
    catch (e) { list = [] }
    if (dRe) {
      const want = dRe[1].trim().replace(/^["']|["']$/g, '')
      list = list.filter((e) => { const h = e.querySelector('h2'); return !!h && txt(h) === want })
    }
    if (tRe) {
      const want = tRe[1].trim().replace(/^["']|["']$/g, '')
      list = list.filter((e) => txt(e) === want)
    }
    if (cRe) {
      const want = cRe[1].trim().replace(/^["']|["']$/g, '')
      list = list.filter((e) => txt(e).includes(want))
    }
    found.push(...list)
  }
  const el = found[(opts && typeof opts.nth === 'number' ? opts.nth : 0)]
  if (!el) return false
  el.scrollIntoView({ block: 'center', inline: 'center' })
  return true
}`

/** Элементы по своему предикату: возвращает ту же геометрию, что и Q_ALL. */
const GEO_BY = `(src, args) => {
  const find = (0, eval)('(' + src + ')')
  let found
  try { found = find.apply(null, args) } catch (e) { return [] }
  const list = Array.isArray(found) ? found : found ? [found] : []
  const out = []
  for (const e of list) {
    if (!e || e.nodeType !== 1) continue
    const r = e.getBoundingClientRect()
    const s = getComputedStyle(e)
    out.push({
      tag: e.tagName.toLowerCase(),
      text: (e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 200),
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
      rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      visible: !!r.width && !!r.height && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0',
      disabled: e.disabled === true || e.getAttribute('aria-disabled') === 'true',
    })
  }
  return out
}`

/** Прямая установка значения через нативный сеттер — так надёжнее для React. */
const SET_VALUE = `(sel, opts, value) => {
  const list = (function () {
    let nodes = []
    try { nodes = Array.from(document.querySelectorAll(sel)) } catch (e) { nodes = [] }
    if (opts && opts.hidden) return nodes
    return nodes.filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height })
  })()
  const el = list[0]
  if (!el) throw new Error('Нет поля: ' + sel)
  el.focus()
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}`

/** Готовность: смонтирован #root, шрифты приложения на месте, заставка ушла. */
const READY = `() => {
  const root = document.getElementById('root')
  if (!root || !root.firstElementChild) return null
  const splash = !!document.querySelector('div.fixed.inset-0.z-\\\\[100\\\\]')
  return { splash, h1: (document.querySelector('h1') || {}).innerText || '' }
}`

/** Чистый старт: сносим базу приложения, кэши и состояние темы. */
const FRESH = `(async () => {
  const del = (name) => new Promise((ok) => {
    const r = indexedDB.deleteDatabase(name)
    r.onsuccess = r.onerror = r.onblocked = () => ok()
  })
  for (const n of (indexedDB.databases ? await indexedDB.databases() : []).map((d) => d.name)) {
    if (n && n.indexOf('momentum') === 0) await del(n)
  }
  localStorage.clear()
  sessionStorage.clear()
  if (window.caches) { for (const k of await caches.keys()) await caches.delete(k) }
  return true
})`

/** Слепок данных: сколько записей в каждой таблице приложения. */
const COUNTS = `(async () => {
  const open = () => new Promise((ok) => {
    const r = indexedDB.open('momentum')
    r.onsuccess = () => ok(r.result)
    r.onerror = () => ok(null)
  })
  const db = await open()
  if (!db) return { error: 'нет базы' }
  const tables = Array.from(db.objectStoreNames)
  const out = {}
  for (const t of tables) {
    out[t] = await new Promise((ok) => {
      try {
        const c = db.transaction(t, 'readonly').objectStore(t).count()
        c.onsuccess = () => ok(c.result)
        c.onerror = () => ok('?')
      } catch (e) { ok('?') }
    })
  }
  db.close()
  return out
})`

/* ---------------------------------------------------------------- запуск --- */

function describeOpts(opts) {
  const keys = Object.keys(opts ?? {})
  return keys.length ? ` ${JSON.stringify(opts)}` : ''
}

/**
 * Отрезать служебные псевдоэлементы, оставив настоящий CSS-селектор.
 * Нужен там, где селектор уходит в querySelectorAll напрямую: браузер
 * ничего не знает про :text-is и честно падает.
 */
function plainSelector(sel) {
  return String(sel)
    .split('||')
    .map((p) =>
      p
        .trim()
        .replace(/:text-contains\([^)]*\)\s*$/, '')
        .replace(/:text-is\([^)]*\)\s*$/, '')
        .replace(/:nth\([^)]*\)\s*$/, '')
        .trim(),
    )
    .filter(Boolean)
    .join(', ')
}

function parseArgs(argv) {
  const out = { base: 'https://dem0neus.github.io/Momentum', only: null, mobile: false, keepOpen: false, headed: false }
  for (const a of argv) {
    if (a.startsWith('--base=')) out.base = a.slice(7).replace(/\/$/, '')
    else if (a.startsWith('--only=')) out.only = a.slice(7).toLowerCase()
    else if (a === '--mobile') out.mobile = true
    else if (a === '--keep-open') out.keepOpen = true
    else if (a === '--headed') out.headed = true
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  let cdp
  try {
    cdp = await Cdp.connect(CDP_PORT)
  } catch {
    console.error(`CDP на порту ${CDP_PORT} не отвечает. Запустите Яндекс.Браузер:`)
    console.error('  "C:\\Program Files\\Yandex\\YandexBrowser\\Application\\browser.exe" --remote-debugging-port=9225 --headless=new --user-data-dir=%TEMP%\\momentum-cdp')
    process.exit(2)
  }

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })

  const page = new Page(cdp, sessionId, args.base)
  await page.send('Page.enable')
  await page.send('Runtime.enable')
  await page.send('Log.enable')
  await page.send('Network.enable')
  await page.send('Emulation.setDeviceMetricsOverride', args.mobile
    ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
    : { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await page.send('Emulation.setTouchEmulationEnabled', args.mobile
    ? { enabled: true, maxTouchPoints: 5 }
    : { enabled: false })

  cdp.on('Runtime.exceptionThrown', (p, sid) => {
    if (sid !== sessionId) return
    const d = p.exceptionDetails
    page.errors.push(d.exception?.description ?? d.text ?? 'исключение')
  })
  cdp.on('Runtime.consoleAPICalled', (p, sid) => {
    if (sid !== sessionId) return
    const text = (p.args ?? []).map((a) => a.value ?? a.description ?? a.type).join(' ')
    const line = `[${p.type}] ${text}`
    if (p.type === 'error') page.errors.push(line)
    else if (p.type === 'warning') page.warnings.push(line)
    else page.console.push(line)
  })
  cdp.on('Log.entryAdded', (p, sid) => {
    if (sid !== sessionId) return
    const e = p.entry
    if (e.level === 'error') page.errors.push(`[${e.source}] ${e.text}`)
    else if (e.level === 'warning') page.warnings.push(`[${e.source}] ${e.text}`)
  })

  // --only=id1,id2 или --only=подстрока имени. Совпадение по id точнее.
  const list = args.only
    ? (() => {
        const wanted = args.only.split(',').map((s) => s.trim()).filter(Boolean)
        const byId = wanted.filter((w) => scenarios.some((s) => s.id === w))
        const rest = wanted.filter((w) => !byId.includes(w))
        const picked = [
          ...scenarios.filter((s) => byId.includes(s.id)),
          ...(rest.length ? scenarios.filter((s) => s.name.toLowerCase().includes(rest[0])) : []),
        ]
        return [...new Set(picked)]
      })()
    : scenarios

  if (!list.length) {
    console.error(`Ни один сценарий не подошёл под «${args.only}». Есть: ${scenarios.map((s) => `${s.id} (${s.name})`).join(', ')}`)
    process.exit(2)
  }

  console.log(`\nСценарии пользователя — ${list.length} шт., адрес ${args.base}, экран ${args.mobile ? '390×844 (телефон)' : '1280×900 (ноутбук)'}\n`)

  const results = []
  for (const sc of list) {
    page.check = new Check()
    page.errors = []
    page.warnings = []
    page.dialog = new Dialog(cdp, sessionId)
    const started = Date.now()
    let verdict = 'ok'
    let note = ''
    process.stdout.write(`  ${sc.name}\n`)
    try {
      await sc.run(page, { mobile: args.mobile, base: args.base, shot: (n) => page.shot(`${sc.id}-${n}`) })
      note = `${page.check.rows.length} проверок`
    } catch (err) {
      verdict = 'fail'
      note = err.message
      const file = await page.shot(`${sc.id}-FAIL`).catch(() => null)
      if (file) note += ` · снимок ${file}`
    }
    const secs = ((Date.now() - started) / 1000).toFixed(1)
    const mark = verdict === 'ok' ? 'хорошо' : 'СЛОМАНО'
    console.log(`    → ${mark}: ${note} (${secs} с)`)
    if (page.errors.length) {
      console.log(`    ошибок в консоли: ${page.errors.length}`)
      for (const e of [...new Set(page.errors)].slice(0, 4)) console.log(`       ${e.slice(0, 200)}`)
    }
    results.push({ name: sc.name, verdict, note, errors: [...new Set(page.errors)], warnings: [...new Set(page.warnings)] })
  }

  const bad = results.filter((r) => r.verdict === 'fail')
  const noisy = results.filter((r) => r.errors.length)
  console.log(`\nИтог: ${results.length - bad.length} из ${results.length} сценариев прошли`)
  if (noisy.length) console.log(`Сценариев с ошибками в консоли: ${noisy.length} (${noisy.map((r) => r.name).join(', ')})`)
  if (bad.length) {
    console.log('\nСломанные:')
    for (const r of bad) console.log(`  ✗ ${r.name}: ${r.note}`)
  }
  writeFileSync(join(SHOT_DIR, '..', 'journey-report.json'), JSON.stringify(results, null, 2))

  if (!args.keepOpen) {
    await cdp.send('Target.closeTarget', { targetId })
    cdp.close()
  }
  process.exit(bad.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
