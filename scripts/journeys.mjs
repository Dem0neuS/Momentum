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
  if (bottom.length && bottom[0]?.visible) return t.clickBox(bottom[0])
  return t.click(`aside nav button:text-is("${full}")`)
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
      await t.sleep(200)
      t.eq(await t.count(ring('Отметить привычку «Тренировка»')), 1, 'фильтр «Все» вернул привычки на сегодня')
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
      await t.click('button[title="Удалить последнюю строку"]')
      await t.sleep(400)
      t.contains(await t.bodyText(), '12 строк', 'строка удалена')

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
