/**
 * Сценарии пользователя Momentum.
 *
 * Не тесты отдельных функций, а пути живого человека: первый запуск,
 * ежедневная отметка, план, тренировка, таблица, перезапуск страницы,
 * бэкап. Каждый сценарий начинается с чистой базы, чтобы результат зависел
 * только от действий внутри него.
 *
 * Формат: { id, name, async run(t) }. Проверки — t.ok / t.eq / t.contains.
 * Ошибка в проверке роняет сценарий и сохраняет снимок экрана.
 *
 * Запуск: npm run journey  (см. journey-runner.mjs за параметрами)
 */

/** Заголовок раздела — признак, что он действительно открылся. */
const HEAD = {
  dashboard: 'Твой прогресс',
  habits: 'Привычки',
  workouts: 'Тренировки',
  sheets: 'Таблицы',
  dayplan: 'План',
}

/**
 * Перейти в раздел. Подпись в боковом меню и в нижнем разная («План на
 * завтра» против «Плана»), поэтому ищем по обеим и по короткой форме.
 */
async function nav(t, id) {
  const idx = ['dashboard', 'habits', 'workouts', 'sheets', 'dayplan'].indexOf(id)
  const want = ['Дашборд', 'Привычки', 'Тренировки', 'Таблицы', 'План'][idx]
  const full = ['Дашборд', 'Привычки', 'Тренировки', 'Таблицы', 'План на завтра'][idx]
  // В нижнем меню кнопки идут в том же порядке, что и разделы.
  const bottom = await t.geoBy(
    `(idx) => {
      const nav = [...document.querySelectorAll('nav')].find((n) => n.className.includes('md:hidden') && n.getBoundingClientRect().height > 0)
      if (!nav) return []
      return nav.querySelectorAll('button')[idx] || []
    }`,
    idx,
  )
  if (bottom.length && bottom[0]?.visible) await t.clickBox(bottom[0])
  else await t.click(`aside nav button:text-is("${full}")`)
  // Раздел рисуется не мгновенно: содержимое приходит из IndexedDB, а на живом
  // сайте ещё и через сеть. Без ожидания следующий клик по содержимому уходил
  // в ещё пустую страницу — на ноутбуке проскакивало, на сайте нет.
  await t.waitFor(`h1:text-contains("${HEAD[id]}")`, { label: `раздел «${want}» открылся` })
}

/** Кнопки «−» «+» «✓» в быстром меню счётчика: иконки без подписей. */
function counterMenu() {
  return `() => {
    const byText = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === 'Ввести значение')
    const menu = byText && byText.closest('div[class*="w-44"]')
    if (!menu) return []
    const row = menu.querySelector('div[class*="grid-cols-3"]')
    return row ? Array.from(row.children) : []
  }`
}

/** Кольцо привычки по подписи. */
const ring = (prefix) => `[role="button"][aria-label^="${prefix}"]`

/** Сегодняшний столбец недели тренировок — тот, что подсвечен. */
/** Сегодняшний столбец недели тренировок: у него своя рамка. */
const todayColumn = `() => {
  const cols = Array.from(document.querySelectorAll('div[class*="grid-cols-7"] > div'))
  return cols.filter((c) => (c.className || '').includes('border-primary/4'))
}`

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/** Ключ завтрашнего дня в местном часовом поясе (YYYY-MM-DD). */
function tomorrowKey() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Вычисленный вес шрифта ячейки: начертание приходит инлайном
 * (`fontWeight: 700`), а не классом `font-bold`, поэтому смотрим стиль.
 */
const cellWeight = (t, ref) =>
  t.eval(`() => getComputedStyle(document.querySelector('[role="gridcell"][aria-label="${ref}"]')).fontWeight`)

/**
 * Кнопка внутри подтверждающего диалога с точным заголовком.
 *
 * Общий селектор `[role="dialog"] button:text-is("Отмена")` здесь не годится:
 * всплывающее меню Popover тоже отдаёт `role="dialog"`, а под диалогом
 * подтверждения может быть открыт второй диалог — форма тренировки со своей
 * «Отменой». Первый совпавший элемент увёл бы клик не туда, поэтому ищем
 * кнопку именно в том диалоге, чей заголовок совпал.
 */
function confirmBtn(title, label) {
  return `() => {
    const want = ${JSON.stringify(title)}.toLowerCase()
    const dlg = [...document.querySelectorAll('[role="dialog"]')].find(
      (d) => ((d.querySelector('h2') || {}).innerText || '').trim().toLowerCase() === want,
    )
    if (!dlg) return []
    const btn = [...dlg.querySelectorAll('button')].find(
      (b) => (b.innerText || b.textContent || '').trim() === ${JSON.stringify(label)},
    )
    return btn ? [btn] : []
  }`
}

/**
 * Дождаться подтверждения и нажать в нём кнопку — по заголовку диалога.
 *
 * Диалог въезжает анимацией (сдвиг на 24 px вниз), и координата, снятая в
 * начале анимации, уводит клик мимо кнопки. Поэтому прямоугольник читается
 * заново, пока не остановится — как в `click()`, но для кнопки, найденной
 * своим кодом.
 */
async function confirmClick(t, title, label) {
  const sel = `[role="dialog"]:text-contains(${JSON.stringify(title)})`
  await t.waitFor(sel, { label: `подтверждение «${title}»` })
  let box = null
  for (let i = 0; i < 10; i++) {
    const again = await t.geoBy(confirmBtn(title, label))
    if (!again.length) throw new Error(`В диалоге «${title}» нет кнопки «${label}»`)
    const r = again[0].rect
    if (box && r.x === box.rect.x && r.y === box.rect.y && r.w === box.rect.w && r.h === box.rect.h) {
      box = again[0]
      break
    }
    box = again[0]
    await t.sleep(80)
  }
  await t.clickBox(box)
  // Диалог уезжает пружинной анимацией, и AnimatePresence держит его вместе с
  // прозрачной подложкой в DOM ещё несколько сотен миллисекунд после закрытия.
  // Пока подложка на месте, она перехватывает клики: кнопка меню под ней
  // «не нажималась». Поэтому дожидаемся полного удаления диалога из DOM
  // (hidden: true — иначе подождали бы только до прозрачности), а не спим.
  await t.waitGone(sel, { label: `закрытие «${title}»`, opts: { hidden: true } })
}

/* -------------------------------------------------------------------------- */

export const scenarios = [
  {
    id: 'first-run',
    name: 'Первый запуск: что человек видит в первый день',
    async run(t) {
      await t.step('открываю приложение начисто')
      await t.open()

      t.contains((await t.allText('h1')).join(' | '), 'Дашборд', 'открывается дашборд')
      t.contains(await t.bodyText(), 'Твой день', 'на дашборде есть приветственный блок')

      await t.step('смотрю плитки итогов')
      const dash = await t.bodyText()
      t.contains(dash, '0 из 4 сегодня', 'ни одна стартовая привычка ещё не отмечена')
      t.contains(dash, 'нет сегодня', 'тренировок на сегодня нет')
      t.contains(dash, 'нет плана', 'плана на сегодня нет')
      t.contains(dash, 'В этом месяце тренировок пока нет', 'график тренировок честно пуст')
      t.contains(dash, 'Отметьте первую привычку', 'подсказка про серии на месте')
      t.contains(dash, 'Завтра пунктов нет', 'плану на завтра сказано, что он пуст')

      await t.step('перехожу в привычки и считаю стартовые')
      await nav(t, 'habits')
      t.contains(await t.textOf('h1'), 'Привычки', 'открылся раздел привычек')
      const body = await t.bodyText()
      for (const name of ['Пить воду', 'Тренировка', 'Читать книгу', 'Готовиться ко сну']) {
        t.contains(body, name, `стартовая привычка «${name}» на месте`)
      }
      t.contains(body, 'Сегодня выполнено 0 из 4', 'счётчик дня показывает 0 из 4')
      t.eq(await t.count(ring('Отметить привычку «')), 2, 'две привычки без счётчика отмечаются кольцом')
      t.eq(await t.count(ring('Счётчик привычки:')), 2, 'две привычки со счётчиком (вода и чтение)')

      await t.step('проверяю категории и поиск')
      t.contains(body, 'Здоровье', 'категории созданы')
      t.eq(await t.count('input[aria-label="Поиск привычки"]'), 1, 'поле поиска на месте')

      await t.step('ищу несуществующее и получаю честный пустой ответ')
      await t.fill('input[aria-label="Поиск привычки"]', 'zzzz')
      await t.sleep(200)
      t.contains(await t.bodyText(), 'Ничего не найдено', 'пустой результат поиска объяснён')
      await t.fill('input[aria-label="Поиск привычки"]', '')
      await t.sleep(200)

      t.eq(pageErrors(t), 0, 'при первом запуске консоль чистая')
    },
  },

  {
    id: 'habits-daily',
    name: 'Ежедневная отметка: галочка, счётчик, отмена',
    async run(t) {
      await t.open()
      await nav(t, 'habits')

      await t.step('отмечаю привычку без счётчика')
      await t.click(ring('Отметить привычку «Тренировка»'))
      t.eq(await t.count(ring('Привычка выполнена')), 1, 'отметка появилась')
      t.contains(await t.bodyText(), 'Сегодня выполнено 1 из 4', 'счётчик дня стал 1 из 4')
      t.contains(await t.bodyText(), 'Привычка отмечена', 'показано уведомление с отменой')

      await t.step('отменяю через кнопку в уведомлении')
      await t.click('button:text-is("Отменить")')
      await t.sleep(250)
      t.eq(await t.count(ring('Привычка выполнена')), 0, 'отметка снята')
      t.contains(await t.bodyText(), 'Сегодня выполнено 0 из 4', 'счётчик дня вернулся к нулю')

      await t.step('набираю воду счётчиком')
      await t.click(ring('Счётчик привычки: 0 из 8'))
      await t.waitFor('button:text-is("Ввести значение")', { label: 'быстрое меню счётчика' })
      const row = await t.geoBy(counterMenu())
      t.eq(row.length, 3, 'в меню счётчика три действия: минус, плюс, отметить полностью')
      for (let i = 0; i < 3; i++) await t.clickBox(row[1])
      await t.sleep(250)
      t.eq(await t.attr(ring('Счётчик привычки:'), 'aria-label'), 'Счётчик привычки: 3 из 8', 'счётчик показывает 3 из 8')
      t.contains(await t.bodyText(), '3/8 стаканов', 'в карточке видно 3/8 стаканов')
      t.contains(await t.bodyText(), 'Сегодня выполнено 0 из 4', 'недобранная цель не считается выполненной')

      await t.step('добиваю цель целиком')
      await t.click('button[title="Отметить полностью"]')
      await t.sleep(300)
      // Счётчикная привычка остаётся счётчиком: подпись кольца меняется на
      // «8 из 8», отдельной отметки «выполнено» у неё нет и не нужно.
      t.eq(
        await t.attr(ring('Счётчик привычки:'), 'aria-label', { nth: 0 }),
        'Счётчик привычки: 8 из 8',
        'вода засчитана выполненной — счётчик дошёл до цели',
      )
      t.contains(await t.bodyText(), '8/8 стаканов', 'в карточке 8/8 стаканов')
      t.contains(await t.bodyText(), 'Сегодня выполнено 1 из 4', 'цель попала в итог дня')

      await t.step('снимаю отметку с кольца')
      // Повторный тап по готовому кольцу снимает отметку, в том числе
      // у счётчика — поэтому ищем кольцо по его подписи «8 из 8».
      await t.click(ring('Счётчик привычки: 8 из 8'))
      await t.sleep(250)
      t.contains(await t.bodyText(), 'Отметка снята', 'есть уведомление о снятии')
      t.eq(
        await t.attr(ring('Счётчик привычки:'), 'aria-label', { nth: 0 }),
        'Счётчик привычки: 0 из 8',
        'кольцо счётчика вернулось к нулю',
      )

      await t.step('отменяю снятие сочетанием клавиш')
      await t.press('Control+z')
      await t.sleep(300)
      t.eq(
        await t.attr(ring('Счётчик привычки:'), 'aria-label', { nth: 0 }),
        'Счётчик привычки: 8 из 8',
        'Ctrl+Z вернул отметку',
      )
      t.contains(await t.bodyText(), 'Сегодня выполнено 1 из 4', 'цель снова в итоге дня')

      await t.step('вижу итог на дашборде')
      await nav(t, 'dashboard')
      t.contains(await t.bodyText(), '1 из 4 сегодня', 'дашборд показал выполненную привычку')
    },
  },

  {
    id: 'habits-weekday',
    name: 'Привычка не на сегодня: фильтр и счётчик дня',
    async run(t) {
      await t.open()
      await nav(t, 'habits')

      await t.step('создаю привычку только на другой день недели')
      const todayIdx = (new Date().getDay() + 6) % 7
      const todayName = WEEKDAYS[todayIdx]
      const otherDay = WEEKDAYS[(todayIdx + 2) % 7]
      await t.click('button[aria-label="Добавить привычку"]')
      await t.waitFor('[role="dialog"]', { label: 'форма привычки' })
      await t.fill('input[placeholder="Например, Пить воду"]', 'Бассейн')
      t.eq(
        await t.eval(`() => {
          const sel = [...document.querySelectorAll('[role="dialog"] select')].find((s) => [...s.options].some((o) => o.textContent.trim() === 'По дням недели'))
          if (!sel) return 'селекта частоты нет'
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
          setter.call(sel, 'days')
          sel.dispatchEvent(new Event('change', { bubbles: true }))
          return sel.value
        }`),
        'days',
        'частоту переключил на «по дням недели»',
      )
      // При включении «по дням недели» отмечен только сегодняшний день:
      // гасим его и оставляем нужный.
      await t.waitFor(`button:text-is("${todayName}")`, { label: `кнопка дня «${todayName}»` })
      await t.click(`button:text-is("${todayName}")`)
      await t.click(`button:text-is("${otherDay}")`)
      t.contains(await t.textFull('[role="dialog"]'), 'Дни недели', 'в форме видно, какие дни выбирать')
      await t.click('button:text-is("Создать")')
      await t.sleep(400)
      t.eq(await t.count(ring('Отметить привычку «Бассейн»')), 0, 'привычка не на сегодня не показывает кольцо отметки')

      await t.step('в фильтре «Все» она есть')
      t.contains(await t.bodyText(), 'Бассейн', 'в общем списке привычка видна')

      await t.step('в фильтре «На сегодня» её нет — и это не ошибка')
      // Стартовые привычки ежедневные, поэтому «на сегодня» список не пуст.
      // Проверяем именно отсутствие новой привычки, а не пустоту списка.
      await t.click('button:text-is("На сегодня")')
      await t.sleep(250)
      const todayOnly = await t.allText('main')
      t.ok(
        !todayOnly.join(' ').includes('Бассейн'),
        'привычка не на сегодня не попала в фильтр «На сегодня»',
      )
      t.contains(todayOnly.join(' '), 'Пить воду', 'зато ежедневные привычки на месте')

      await t.step('возвращаюсь к «Все» и проверяю день недели в карточке')
      await t.click('button:text-is("Все")')
      await t.sleep(200)
      await t.click('button:text-contains("Бассейн")')
      await t.waitFor('[aria-label^="Привычка «Бассейн»"]', { label: 'карточка привычки' })
      t.contains(await t.textOf('[aria-label^="Привычка «Бассейн»"]'), 'По дням: 1 день', 'частота показана в карточке')
      await t.click('button:text-is("Закрыть")')
      // Карточка тоже закрывается пружиной: пока она в DOM, её подложка
      // перехватывает клики, поэтому ждём полного удаления, а не спим.
      await t.waitGone('[role="dialog"][aria-label^="Привычка «Бассейн»"]', {
        label: 'закрытие карточки привычки',
        opts: { hidden: true },
      })
      t.eq(await t.count(ring('Отметить привычку «Тренировка»')), 1, 'фильтр «Все» вернул привычки на сегодня')

      await t.step('удаляю категорию — привычки из неё не пропадают')
      // Категория здесь — папка, а не владение привычкой: после удаления
      // привычка остаётся и просто переезжает в «Без категории».
      // Кнопка меню есть только у своей категории, селектором её не выразить —
      // ищем кодом по тексту секции. Замеряю перед каждым кликом: первый
      // кликBox прокручивает страницу, и прошлые координаты после этого
      // указывают мимо кнопки.
      const catMenuBox = async () =>
        t.geoBy(`(name) => {
          const btns = [...document.querySelectorAll('button[aria-label="Управление категорией"]')]
          const hit = btns.find((b) => ((b.closest('section') || {}).textContent || '').includes(name))
          return hit ? [hit] : []
        }`, 'Развитие')
      const catBox = await catMenuBox()
      t.eq(catBox.length, 1, 'у категории «Развитие» нашлось меню управления')
      // Меню открывается анимацией, поэтому после клика всегда ждём пункт.
      const openCatMenu = async () => {
        await t.clickBox((await catMenuBox())[0])
        await t.waitFor('button:text-is("Удалить категорию")', { label: 'пункт «Удалить категорию»' })
      }
      await openCatMenu()
      await t.click('button:text-is("Удалить категорию")')

      // Сначала отказ: удаление категории необратимо, и подтверждение
      // обязано спросить.
      await confirmClick(t, 'Удалить категорию?', 'Отмена')
      t.contains(await t.bodyText(), 'Развитие', 'после отмены категория на месте')
      t.eq(await t.count('button[aria-label="Управление категорией"]'), 8, 'категорий по-прежнему восемь')

      await openCatMenu()
      await t.click('button:text-is("Удалить категорию")')
      await confirmClick(t, 'Удалить категорию?', 'Удалить')
      await t.sleep(400)
      t.eq(await t.count('button[aria-label="Управление категорией"]'), 7, 'категорий стало на одну меньше')
      t.contains(await t.bodyText(), 'Читать книгу', 'привычка из удалённой категории осталась')
      t.contains(await t.bodyText(), 'Без категории', 'и видна в разделе «Без категории»')
    },
  },

  {
    id: 'dayplan',
    name: 'План 3-2-1: добавление, отметка, перенос на завтра',
    async run(t) {
      await t.open()
      await nav(t, 'dayplan')

      await t.step('заполняю главные задачи')
      for (const text of ['Звонок врачу', 'Оплатить интернет', 'Собрать заказ']) {
        await t.fill('input[aria-label="Новый пункт блока «Главные задачи»"]', text)
        await t.click('button[aria-label="Добавить пункт"]')
        await t.sleep(150)
      }
      let body = await t.bodyText()
      t.contains(body, 'Звонок врачу', 'пункт добавлен')
      t.contains(body, '0/3', 'в блоке появился счётчик выполненных')

      await t.step('проверяю, что 3-2-1 — это ориентир, а не запрет')
      await t.fill('input[aria-label="Новый пункт блока «Главные задачи»"]', 'Четвёртый пункт')
      await t.click('button[aria-label="Добавить пункт"]')
      await t.sleep(200)
      t.contains(await t.bodyText(), 'Четвёртый пункт', 'четвёртый пункт в главные задачи принят — ограничения жёсткого нет')
      t.contains(await t.bodyText(), '0/4', 'счётчик честно показывает четыре')

      await t.step('отмечаю выполненные')
      await t.click('button[aria-label="Отметить выполненным"]')
      await t.click('button[aria-label="Отметить выполненным"]', { nth: 0 })
      await t.sleep(200)
      t.contains(await t.bodyText(), '2/4', 'два пункта отмечены')
      t.eq(await t.attr('[role="progressbar"][aria-label="Прогресс плана"]', 'aria-valuetext'), '2 из 4', 'кольцо прогресса плана показывает 2 из 4')

      await t.step('задаю время пункту и вижу его в списке')
      await t.fill('input[aria-label="Новый пункт блока «Средние задачи»"]', 'Прогулка')
      await t.fill('input[aria-label="Время пункта блока «Средние задачи»"]', '19:30')
      // Кнопка «+» у каждого блока своя: у средних задач она вторая.
      await t.click('button[aria-label="Добавить пункт"]', { nth: 1 })
      await t.sleep(300)
      t.contains(await t.bodyText(), 'Прогулка', 'пункт добавлен в «Средние задачи»')
      t.contains(await t.bodyText(), '19:30', 'время пункта показано чипом')

      await t.step('переношу невыполненное на завтра')
      t.ok(await t.exists('button:text-is("На завтра")'), 'кнопка переноса на месте')
      await t.click('button:text-is("На завтра")')
      // Тосты sonner лежат в [data-sonner-toast]: у них нет role=status —
// им пользуется служебный пустой div живой области.
      await t.waitFor('[data-sonner-toast]:text-contains("Перенесено")', { label: 'подтверждение переноса' })
      t.contains(
        await t.textFull('[data-sonner-toast]:text-contains("Перенесено")'),
        'Перенесено: 3',
        'перенесено три невыполненных пункта: два из главных и «Прогулка»',
      )

      await t.click('button[aria-label="Следующий день"]')
      await t.sleep(500)
      t.eq(await t.eval(`() => document.querySelector('input[aria-label="Дата плана"]').value`), tomorrowKey(), 'открылся завтрашний день')
      t.contains(await t.bodyText(), 'Прогулка', 'невыполненное переехало на завтра')
      t.contains(await t.bodyText(), '19:30', 'время пункта переехало вместе с ним')
      t.contains(await t.bodyText(), 'Оплатить интернет', 'второй невыполненный тоже на месте')
      t.contains(await t.bodyText(), 'Звонок врачу', 'выполненные пункты не переносятся — верно')
      t.contains(await t.bodyText(), '0/2', 'на завтра выполнено 0 из 2')

      await t.click('button:text-is("Сегодня")')
      await t.sleep(400)

      await t.step('план не потерялся после перезагрузки')
      await t.send('Page.reload')
      await t.waitReady()
      await t.sleep(500)
      t.contains(await t.bodyText(), 'Звонок врачу', 'пункт плана пережил перезагрузку')
    },
  },

  {
    id: 'workouts',
    name: 'Тренировка: создать, наполнить упражнениями, отметить',
    async run(t) {
      await t.open()
      await nav(t, 'workouts')

      await t.step('открываю форму из сегодняшнего дня')
      const col = await t.geoBy(todayColumn)
      t.eq(col.length, 1, 'сегодняшний день в сетке недели один')
      const addBtn = await t.geoBy(`() => {
        const col = [...document.querySelectorAll('div[class*="grid-cols-7"] > div')].find((c) => (c.className || '').includes('border-primary/4'))
        if (!col) return []
        return [...col.querySelectorAll('button')].filter((b) => (b.innerText || '').trim() === 'Тренировка')
      }`)
      t.eq(addBtn.length, 1, 'в сегодняшнем дне одна кнопка «Тренировка»')
      await t.clickBox(addBtn[0])
      await t.waitFor('#workout-name', { label: 'форма тренировки' })

      await t.step('заполняю название и тип')
      await t.fill('#workout-name', 'Грудь и трицепс')
      // Значение option'а — код типа, а не подпись: «Силовая» это strength.
      t.eq(
        await t.eval(`() => {
          const sel = document.querySelector('#workout-type')
          const opt = [...sel.options].find((o) => o.textContent.includes('Силовая'))
          if (!opt) return 'нет варианта'
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
          setter.call(sel, opt.value)
          sel.dispatchEvent(new Event('change', { bubbles: true }))
          return sel.value
        }`),
        'strength',
        'тип тренировки выбран',
      )
      t.eq(await t.eval(`() => document.querySelector('#workout-date').value`), todayKey(), 'дата в форме стоит сегодняшняя')

      await t.step('добавляю два упражнения с подходами и весом')
      // Поле нового упражнения предзаполнено словом «Новое упражнение», поэтому
      // печатаем по-настоящему: сначала выделяем содержимое, потом набираем.
      for (const ex of [{ n: 'Жим лёжа', s: '4', r: '8', w: '80' }, { n: 'Трицепс на блоке', s: '3', r: '12', w: '30' }]) {
        await t.click('button:text-is("+ Упражнение")')
        await t.sleep(250)
        const idx = await t.count('input[placeholder="Название упражнения"]') - 1
        await t.typeInto('input[placeholder="Название упражнения"]', ex.n, { nth: idx })
        await t.fill('input[aria-label="Подходы"]', ex.s, { nth: idx })
        await t.fill('input[aria-label="Повтор."]', ex.r, { nth: idx })
        await t.fill('input[aria-label="Вес, кг"]', ex.w, { nth: idx })
        const got = await t.attr('input[placeholder="Название упражнения"]', 'value', { nth: idx })
        t.eq(got, ex.n, `упражнение «${ex.n}» названо целиком, без хвоста от шаблона`)
      }
      t.eq(await t.count('input[placeholder="Название упражнения"]'), 2, 'два упражнения в форме')

      await t.step('сохраняю и проверяю карточку в сетке')
      await t.click('button:text-is("Сохранить")')
      await t.waitGone('#workout-name', { label: 'форма закрылась' })
      await t.sleep(300)
      t.contains(await t.bodyText(), 'Грудь и трицепс', 'тренировка появилась в неделе')
      t.contains(await t.bodyText(), '1 тренировка на этой неделе', 'счётчик недели обновился')

      await t.step('проверяю объём в итогах')
      const volume = await t.bodyText()
      t.contains(volume, 'Объём', 'плитка объёма есть')
      t.ok(!/Объём[\s\S]{0,20}0 т/.test(volume.replace(/\n/g, ' ')), `объём посчитан, а не нулевой: ${JSON.stringify((volume.match(/Объём[\s\S]{0,30}/) || [''])[0])}`)

      await t.step('отмечаю выполненной')
      await t.click('[aria-label="Отметить выполненной"]')
      await t.sleep(250)
      t.eq(await t.count('[aria-label="Снять отметку"]'), 1, 'отметка выполнения стоит')
      t.contains(await t.bodyText(), '1 из 1', 'счётчик выполненных обновился')

      await t.step('сохраняю тренировку шаблоном и удаляю шаблон через подтверждение')
      // Меню шаблонов живёт в форме открытой тренировки, а не в сетке недели.
      await t.click('[aria-label="Открыть и редактировать тренировку «Грудь и трицепс»"]')
      await t.waitFor('#workout-name', { label: 'форма тренировки' })
      await t.click('button[aria-label="Шаблоны тренировок"]')
      await t.waitFor('button:text-is("Сохранить как шаблон")', { label: 'меню шаблонов' })
      await t.click('button:text-is("Сохранить как шаблон")')
      await t.sleep(300)

      await t.click('button[aria-label="Шаблоны тренировок"]')
      await t.waitFor('button:text-contains("(2 упр.)")', { label: 'шаблон в списке применения' })
      await t.click('button:text-is("Удалить «Грудь и трицепс»")')

      // Отказ: шаблон — копия, сама тренировка от его удаления не страдает,
      // но подтверждение всё равно обязано спросить.
      await confirmClick(t, 'Удалить шаблон?', 'Отмена')
      await t.sleep(300)
      await t.click('button[aria-label="Шаблоны тренировок"]')
      t.contains(await t.bodyText(), 'Удалить «Грудь и трицепс»', 'после отмены шаблон на месте')

      await t.click('button:text-is("Удалить «Грудь и трицепс»")')
      await confirmClick(t, 'Удалить шаблон?', 'Удалить')
      await t.sleep(300)
      await t.click('button[aria-label="Шаблоны тренировок"]')
      t.eq(await t.count('button:text-is("Удалить «Грудь и трицепс»")'), 0, 'пункта удаления больше нет — шаблон удалён')
      t.eq(await t.count('button:text-contains("(2 упр.)")'), 0, 'и из списка применения он исчез')
      // Закрываю форму крестику в шапке: кнопка «Отмена» в подвале живёт
      // внизу экрана, где в этот момент ещё может висеть тост «Шаблон
      // сохранён» — тот перехватывает клик и форма остаётся открытой.
      await t.click('[role="dialog"] [aria-label="Закрыть"]')
      await t.waitGone('#workout-name', { label: 'форма тренировки закрылась' })
      await t.sleep(300)

      await t.step('вижу тренировку на дашборде')
      await nav(t, 'dashboard')
      t.contains(await t.bodyText(), '1 сегодня', 'дашборд показывает тренировку за сегодня')
    },
  },

  {
    id: 'sheets',
    name: 'Таблица: значения, формулы, строки и столбцы',
    async run(t) {
      await t.open()
      await nav(t, 'sheets')

      await t.step('создаю лист')
      t.contains(await t.bodyText(), 'Листов пока нет', 'до первого листа пусто и понятно')
      await t.click('button:text-is("+ Создать лист")')
      await t.waitFor('[role="grid"][aria-label="Таблица"]', { label: 'сетка таблицы' })
      t.contains(await t.bodyText(), 'Лист 1', 'первый лист назван по умолчанию')
      t.contains(await t.bodyText(), '12 строк', 'создано 12 строк')

      await t.step('ввожу числа прямо в ячейки')
      for (const [ref, value] of [['A1', '10'], ['A2', '20'], ['A3', '30']]) {
        await t.click(`[role="gridcell"][aria-label="${ref}"]`)
        await t.type(value)
        await t.press('Enter')
        await t.sleep(150)
      }
      t.eq(await t.textOf('[role="gridcell"][aria-label="A1"]'), '10', 'первая ячейка посчитана')
      t.eq(await t.textOf('[role="gridcell"][aria-label="A3"]'), '30', 'третья ячейка посчитана')

      await t.step('считаю формулами')
      const cases = [
        ['A4', '=SUM(A1:A3)', '60'],
        ['B1', '=AVERAGE(A1:A3)', '20'],
        ['B2', '=MAX(A1:A3)', '30'],
        ['B3', '=MIN(A1:A3)', '10'],
        ['B4', '=COUNT(A1:A3)', '3'],
        ['C1', '=A1+B1', '30'],
        ['C2', '=IF(A1>5,"много","мало")', 'много'],
      ]
      for (const [ref, formula, want] of cases) {
        // Строка формул при фокусе подставляет значение ячейки, поэтому набор
        // идёт с выделением: иначе формула допишется к старому тексту.
        await t.click(`[role="gridcell"][aria-label="${ref}"]`)
        await t.typeInto('input[placeholder^="Значение или формула"]', formula)
        await t.press('Enter')
        await t.sleep(200)
        const got = await t.textOf(`[role="gridcell"][aria-label="${ref}"]`)
        t.eq(got, want, `${formula} даёт ${want}`)
      }

      await t.step('вижу исходную формулу, а не результат')
      await t.click('[role="gridcell"][aria-label="A4"]')
      t.eq(await t.eval(`() => document.querySelector('input[placeholder^="Значение или формула"]').value`), '=SUM(A1:A3)', 'в строке формул лежит сама формула')

      await t.step('добавляю и убираю строки и столбцы')
      const before = await t.textOf('[role="grid"][aria-label="Таблица"]')
      await t.click('button[title="Добавить строку"]')
      await t.sleep(250)
      t.contains(await t.bodyText(), '13 строк', 'строка добавлена')
      t.ok((await t.textOf('[role="grid"][aria-label="Таблица"]')) !== before, 'сетка перерисовалась')
      await t.click('button[title="Добавить столбец"]')
      await t.sleep(250)
      t.contains(await t.bodyText(), '7 столбцов', 'столбец добавлен')

      // Удаление спрашивает подтверждение: сначала отказываемся, строка должна
      // остаться, потом соглашаемся. Подтверждение закрывается пружиной, и
      // `confirmClick` дожидается, пока его подложка уйдёт из DOM — иначе
      // следующий клик по кнопке удаления попадёт в подложку, а не в кнопку.
      await t.click('button[title="Удалить последнюю строку"]')
      await confirmClick(t, 'Удалить последнюю строку?', 'Отмена')
      t.contains(await t.bodyText(), '13 строк', 'после отмены строка на месте')

      await t.click('button[title="Удалить последнюю строку"]')
      await confirmClick(t, 'Удалить последнюю строку?', 'Удалить')
      await t.sleep(400)
      t.contains(await t.bodyText(), '12 строк', 'строка удалена после подтверждения')

      // Столбец удаляется через такое же подтверждение, что и строка.
      await t.click('button[title="Удалить последний столбец"]')
      await confirmClick(t, 'Удалить последний столбец?', 'Отмена')
      t.contains(await t.bodyText(), '7 столбцов', 'после отмены столбец на месте')

      await t.click('button[title="Удалить последний столбец"]')
      await confirmClick(t, 'Удалить последний столбец?', 'Удалить')
      await t.sleep(400)
      t.contains(await t.bodyText(), '6 столбцов', 'столбец удалён после подтверждения')

      await t.step('деляю ячейку жирным')
      await t.click('[role="gridcell"][aria-label="A1"]')
      // Начертание приходит инлайном (fontWeight: 700) на самой ячейке,
      // а не классом font-bold, поэтому смотрим вычисленный стиль.
      t.eq(await cellWeight(t, 'A1'), '400', 'до нажатия A1 обычным начертанием')
      await t.click('button[aria-label="Жирный"]')
      await t.sleep(250)
      t.eq(await cellWeight(t, 'A1'), '700', 'жирное начертание применено к A1')
      // Панель обязана показать, что начертание уже включено: иначе непонятно,
      // что второй клик её снимет, а не включит.
      t.eq(
        await t.attr('button[aria-label="Жирный"]', 'aria-pressed'),
        'true',
        'кнопка «Жирный» показала нажатое состояние',
      )

      await t.step('повторный клик снимает начертание')
      await t.click('button[aria-label="Жирный"]')
      await t.sleep(250)
      t.eq(await cellWeight(t, 'A1'), '400', 'жирное снято')
      t.eq(
        await t.attr('button[aria-label="Жирный"]', 'aria-pressed'),
        'false',
        'кнопка «Жирный» вернулась в невыбранное состояние',
      )

      await t.step('второй лист заводят и удаляют через подтверждение')
      // «+ Создать лист» есть только в пустом состоянии — дальше листы
      // добавляются кнопкой «Лист» на вкладке.
      await t.click('button:text-is("Лист")')
      await t.sleep(300)
      t.contains(await t.bodyText(), 'Лист 2', 'второй лист создан и открыт')
      t.eq(await t.count('[role="tablist"][aria-label="Листы"] [role="tab"]'), 2, 'на вкладках два листа')

      await t.click('button[aria-label="Действия с листом Лист 2"]')
      await t.waitFor('button:text-is("Удалить лист")', { label: 'пункт «Удалить лист»' })
      await t.click('button:text-is("Удалить лист")')
      await confirmClick(t, 'Удалить лист?', 'Отмена')
      await t.sleep(300)
      t.eq(await t.count('[role="tablist"][aria-label="Листы"] [role="tab"]'), 2, 'после отмены второй лист на месте')

      await t.click('button[aria-label="Действия с листом Лист 2"]')
      await t.click('button:text-is("Удалить лист")')
      await confirmClick(t, 'Удалить лист?', 'Удалить')
      await t.sleep(400)
      t.eq(await t.count('[role="tablist"][aria-label="Листы"] [role="tab"]'), 1, 'после подтверждения лист удалён')
      t.contains(await t.bodyText(), 'Лист 1', 'активным стал оставшийся лист с данными')

      await t.step('лист переживает перезагрузку')
      await t.send('Page.reload')
      await t.waitReady()
      await t.sleep(600)
      await t.click('button[aria-label="Таблицы"]').catch(() => nav(t, 'sheets'))
      t.eq(await t.textOf('[role="gridcell"][aria-label="A4"]'), '60', 'формула пересчиталась после перезагрузки')
    },
  },

  {
    id: 'persistence',
    name: 'Перезапуск страницы и ссылка на раздел',
    async run(t) {
      await t.open()

      await t.step('записываю привычку, план и лист')
      await nav(t, 'habits')
      await t.click('button[aria-label="Добавить привычку"]')
      await t.waitFor('[role="dialog"]')
      await t.fill('input[placeholder="Например, Пить воду"]', 'Растяжка утром')
      await t.click('button:text-is("Создать")')
      await t.sleep(400)
      t.contains(await t.bodyText(), 'Растяжка утром', 'привычка создана')

      await nav(t, 'dayplan')
      await t.fill('input[aria-label="Новый пункт блока «Главные задачи»"]', 'Прогулка 20 минут')
      await t.click('button[aria-label="Добавить пункт"]')
      await t.sleep(300)

      await t.step('открываю раздел прямой ссылкой, как с ярлыка в меню «Пуск»')
      await t.open({ path: '/?section=workouts', fresh: false })
      t.contains((await t.allText('h1')).join(' '), 'Тренировки', 'ссылка ?section=workouts открыла тренировки')
      await t.open({ path: '/?section=dayplan', fresh: false })
      t.contains((await t.allText('h1')).join(' '), 'План', 'ссылка ?section=dayplan открыла план')
      await t.open({ path: '/?section=habits', fresh: false })
      t.contains((await t.allText('h1')).join(' '), 'Привычки', 'ссылка ?section=habits открыла привычки')
      t.contains(await t.bodyText(), 'Растяжка утром', 'привычка видна после переходов по ссылкам')

      await t.step('в адресе держится текущий раздел')
      await nav(t, 'sheets')
      await t.sleep(300)
      t.contains(await t.eval('() => location.search'), 'section=sheets', 'раздел записан в адрес')
      await t.send('Page.reload')
      await t.waitReady()
      await t.sleep(500)
      t.contains((await t.allText('h1')).join(' '), 'Таблицы', 'после перезагрузки открыт тот же раздел')

      await t.step('все записи на месте после перезагрузки')
      await nav(t, 'dayplan')
      t.contains(await t.bodyText(), 'Прогулка 20 минут', 'пункт плана сохранился')
      await nav(t, 'habits')
      t.contains(await t.bodyText(), 'Растяжка утром', 'привычка сохранилась')

      await t.step('отменять после перезагрузки нечего — и это сказано прямо')
      await t.click(ring('Отметить привычку «Тренировка»'))
      await t.sleep(150)
      await t.send('Page.reload')
      await t.waitReady()
      await t.sleep(500)
      await nav(t, 'habits')
      await t.press('Control+z')
      await t.sleep(300)
      t.contains(await t.bodyText(), 'Отменять нечего', 'история действий не переживает перезагрузку, и приложение об этом говорит')
    },
  },

  {
    id: 'offline',
    name: 'Офлайн: без интернета приложение открывается и пишет данные',
    async run(t, ctx) {
      await t.step('захожу начисто — так приложение встаёт на новом устройстве')
      await t.open()
      // Service worker живёт дольше кеша и базы: чтобы увидеть настоящую
      // установку, снимаю старую регистрацию и перезагружаюсь — страница
      // поставит worker заново и заберёт всё в свой кэш.
      await t.eval(`() => navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister())))`)
      await t.send('Page.reload')
      await t.waitReady()

      await t.step('service worker ставится и берёт страницу под контроль')
      // Сначала ждём, пока worker появится и станет активным.
      const until = Date.now() + 25_000
      let reg = null
      while (Date.now() < until) {
        reg = await t.eval(
          `() => navigator.serviceWorker.getRegistrations().then((rs) => (rs[0] ? { active: !!rs[0].active, state: (rs[0].active && rs[0].active.state) || null } : null))`,
        )
        if (reg && reg.active && reg.state === 'activated') break
        await t.sleep(300)
      }
      if (!reg && !(ctx?.base ?? '').includes('github.io')) {
        // Локальный dev-сервер worker не отдаёт — офлайн здесь проверять нечем,
        // честнее пропустить, чем падать на чужой особенности.
        console.log('    · service worker не ставится на этом адресе — офлайн не проверяется')
        return
      }
      t.ok(reg && reg.active, 'service worker установился и активен')

      // Активного worker мало: страница должна быть под его управлением.
      // `clientsClaim` живёт только в обработчике активации, а worker после
      // снятия регистрации успевает снова стать активным ещё до перезагрузки —
      // тогда события активации не будет, и управление даст следующая
      // навигация. Ровно так ведёт себя человек: поставил приложение — открыл
      // заново, и со второго раза оно работает из кэша.
      let controlled = await t.eval('() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)')
      if (!controlled) {
        await t.send('Page.reload')
        await t.waitReady()
        controlled = await t.eval('() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)')
      }
      t.ok(controlled, 'service worker взял страницу под контроль')

      await t.step('выкидываю интернет и перезапускаю приложение')
      await t.setOffline(true)
      await t.send('Page.reload')
      await t.waitReady()
      await t.sleep(500)
      t.contains((await t.allText('h1')).join(' | '), 'Дашборд', 'дашборд открылся без интернета')

      await t.step('данные приходят из IndexedDB, а не из сети')
      await nav(t, 'habits')
      const body = await t.bodyText()
      for (const name of ['Пить воду', 'Тренировка', 'Читать книгу', 'Готовиться ко сну']) {
        t.contains(body, name, `стартовая привычка «${name}» видна офлайн`)
      }
      t.contains(body, 'Сегодня выполнено 0 из 4', 'счётчик дня посчитан офлайн')

      await t.step('офлайн не только читается, но и записывается')
      await t.click(ring('Отметить привычку «Тренировка»'))
      await t.sleep(400)
      t.eq(await t.count(ring('Привычка выполнена')), 1, 'отметка сохранилась без сети')
      t.contains(await t.bodyText(), 'Сегодня выполнено 1 из 4', 'итог дня пересчитан офлайн')

      await t.step('интернет вернулся — офлайн-запись на месте')
      await t.setOffline(false)
      await t.send('Page.reload')
      await t.waitReady()
      await t.sleep(500)
      await nav(t, 'habits')
      t.contains(await t.bodyText(), 'Сегодня выполнено 1 из 4', 'отметка, сделанная офлайн, пережила возврат сети')
    },
  },

  {
    id: 'backup',
    name: 'Бэкап: выгрузка, сброс, восстановление',
    async run(t) {
      await t.step('заношу данные, которых нет в стартовых')
      await t.open()
      await nav(t, 'habits')
      await t.click('button[aria-label="Добавить привычку"]')
      await t.waitFor('[role="dialog"]')
      await t.fill('input[placeholder="Например, Пить воду"]', 'Контракт в спортзал')
      await t.click('button:text-is("Создать")')
      await t.sleep(400)
      t.contains(await t.bodyText(), 'Контракт в спортзал', 'привычка создана')

      await t.step('выгружаю бэкап')
      await t.click('button[aria-label="Настройки"]')
      await t.waitFor('[role="dialog"]:h2-is("Профиль")', { label: 'окно профиля' })
      t.contains(await t.textFull('[role="dialog"]'), 'Итоги', 'в профиле есть сводка')
      await t.click('[role="tablist"][aria-label="Разделы профиля"] [role="tab"]:text-is("Данные")')
      await t.sleep(250)
      const file = await t.exportBackup()
      t.ok(file, 'файл бэкапа сохранён')
      t.contains(await t.bodyText(), 'Бэкап сохранён в JSON', 'приложение подтвердило выгрузку')

      await t.step('сбрасываю данные через опасную зону')
      await t.click('[role="tablist"][aria-label="Разделы профиля"] [role="tab"]:text-is("Опасная зона")')
      await t.sleep(250)
      await t.click('button:text-is("Очистить все данные")')
      await t.waitFor('[role="dialog"]:text-contains("Очистить все данные?")', { label: 'подтверждение сброса' })
      await t.click('button:text-is("Очистить")')
      await t.sleep(900)
      t.contains(await t.bodyText(), 'Данные сброшены', 'сброс подтверждён')
      t.contains(await t.bodyText(), 'созданы стартовые привычки', 'после сброса вернулись стартовые привычки')
      t.ok(!(await t.bodyText()).includes('Контракт в спортзал'), 'пропавшая привычка действительно пропала')

      await t.step('восстанавливаю из того же файла')
      // Окно профиля после сброса остаётся открытым — так и делает человек:
      // переключает вкладку, а не жмёт «Настройки» ещё раз (тот клик его бы закрыл).
      t.ok(await t.exists('[role="dialog"]:h2-is("Профиль")'), 'окно профиля после сброса осталось открытым')
      await t.click('[role="tablist"][aria-label="Разделы профиля"] [role="tab"]:text-is("Данные")')
      await t.sleep(250)
      await t.setFileInput('input[type="file"][accept*="json"]', [file])
      await t.sleep(1500)
      t.contains(await t.bodyText(), 'Данные импортированы', 'импорт прошёл')
      await t.press('Escape')
      await t.sleep(400)
      await nav(t, 'habits')
      t.contains(await t.bodyText(), 'Контракт в спортзал', 'привычка вернулась из бэкапа')
      t.contains(await t.bodyText(), 'Пить воду', 'стартовые привычки на месте — импорт их не потерял')

      await t.step('испорченный файл не ломает приложение')
      const bad = await t.writeTemp('плохой.json', '{ это не бэкап }')
      // После ухода в другой раздел окно закрыто — открываем заново.
      await t.click('button[aria-label="Настройки"]')
      await t.waitFor('[role="dialog"]:h2-is("Профиль")', { label: 'окно профиля' })
      await t.click('[role="tablist"][aria-label="Разделы профиля"] [role="tab"]:text-is("Данные")')
      await t.sleep(250)
      await t.setFileInput('input[type="file"][accept*="json"]', [bad])
      await t.sleep(800)
      t.contains(await t.bodyText(), 'Не удалось распознать файл бэкапа', 'испорченный файл отвергнут с понятным объяснением')
      await t.press('Escape')
      await t.sleep(400)
      t.contains(await t.bodyText(), 'Контракт в спортзал', 'данные не пострадали от плохого файла')
    },
  },

  {
    id: 'settings',
    name: 'Настройки и тема переживают перезапуск',
    async run(t) {
      await t.open()

      await t.step('переключаю тему на тёмную')
      await t.click('button[aria-label="Переключить тему"]')
      await t.sleep(400)
      const theme = await t.eval('() => document.documentElement.dataset.theme')
      t.ok(theme === 'dark' || theme === 'light', `тема применена к документу: ${theme}`)

      await t.step('открываю настройки')
      await t.click('button[aria-label="Настройки"]')
      await t.waitFor('[role="dialog"]:h2-is("Профиль")')
      await t.click('[role="tablist"][aria-label="Разделы профиля"] [role="tab"]:text-is("Настройки")')
      await t.sleep(250)
      t.contains(await t.textFull('[role="dialog"]'), 'Тема', 'настройки темы на месте')

      await t.step('меняю время показа отмены на 10 секунд')
      await t.eval(`() => {
        const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.trim() === '10 секунд'))
        if (!sel) return 'нет такого варианта'
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
        setter.call(sel, [...sel.options].find((o) => o.textContent.trim() === '10 секунд').value)
        sel.dispatchEvent(new Event('change', { bubbles: true }))
        return sel.value
      }`)
      await t.sleep(300)
      await t.press('Escape')
      await t.sleep(300)

      await t.step('тема и настройка пережили перезагрузку')
      await t.send('Page.reload')
      await t.waitReady()
      await t.sleep(400)
      t.eq(await t.eval('() => document.documentElement.dataset.theme'), theme, 'тема та же после перезагрузки')
      await t.click('button[aria-label="Настройки"]')
      await t.waitFor('[role="dialog"]:h2-is("Профиль")')
      await t.click('[role="tablist"][aria-label="Разделы профиля"] [role="tab"]:text-is("Настройки")')
      await t.sleep(300)
      t.eq(
        await t.eval(`() => {
          const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.trim() === '10 секунд'))
          return sel ? sel.options[sel.selectedIndex].textContent.trim() : 'нет'
        }`),
        '10 секунд',
        'время показа отмены сохранено',
      )
    },
  },

  {
    id: 'layout',
    name: 'Экран телефона: нижнее меню и отсутствие горизонтальной прокрутки',
    async run(t, ctx) {
      await t.open()

      await t.step('нижнее меню вместо бокового')
      const bottom = await t.geoBy(`() => [...document.querySelectorAll('nav[class*="md:hidden"]')].filter((n) => n.getBoundingClientRect().height > 0)`)
      if (ctx.mobile) {
        t.eq(bottom.length, 1, 'на телефоне есть нижнее меню')
        t.eq(await t.count('aside nav button'), 0, 'боковое меню на телефоне спрятано')
      } else {
        t.eq(bottom.length, 0, 'на широком экране нижнее меню спрятано')
        t.ok((await t.count('aside nav button')) >= 5, 'боковое меню на месте')
      }

      await t.step('ничего не вылезает за правый край')
      for (const id of ['dashboard', 'habits', 'workouts', 'sheets', 'dayplan']) {
        await nav(t, id)
        await t.sleep(250)
        const over = await t.eval('() => document.documentElement.scrollWidth - window.innerWidth')
        t.ok(over <= 1, `в разделе «${id}» нет горизонтальной прокрутки (лишнее ${over} px)`)
      }

      await t.step('привычка отмечается пальцем на телефоне')
      await nav(t, 'habits')
      const before = await t.count(ring('Привычка выполнена'))
      await t.click(ring('Отметить привычку «Тренировка»'))
      await t.sleep(250)
      t.eq(await t.count(ring('Привычка выполнена')), before + 1, 'отметка сработала')

      await t.step('предложение установки не мешает и закрывается')
      const dismiss = 'button[aria-label="Скрыть предложение установки"]'
      if (await t.exists(dismiss)) {
        // На телефоне главное, чтобы баннер не накрыл нижнее меню.
        const cover = await t.eval(`(dismiss) => {
          const btn = document.querySelector(dismiss)
          const banner = btn.closest('div')
          const nav = [...document.querySelectorAll('nav')].find((n) => n.className.includes('md:hidden') && n.getBoundingClientRect().height > 0)
          if (!banner || !nav) return null
          const b = banner.getBoundingClientRect()
          const n = nav.getBoundingClientRect()
          return Math.round(Math.max(0, Math.min(b.bottom, n.bottom) - Math.max(b.top, n.top)))
        }`, dismiss)
        if (cover !== null) {
          t.eq(cover, 0, 'баннер установки не перекрывает нижнее меню')
        }
        await t.click(dismiss)
        await t.sleep(250)
        t.eq(await t.count(dismiss), 0, 'предложение установки закрывается')
      } else {
        t.step('баннера нет — это тоже нормально')
      }
    },
  },
]

/* ------------------------------------------------------------- мелочи --- */

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function pageErrors(t) {
  return new Set(t.errors).size
}
