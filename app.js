import { DOM_CATEGORIES, DOM_GUIDES, DOM_CATEGORY_BY_ID, DOM_GUIDE_BY_ID } from './content.js'

const STORAGE_KEY = 'qsen-dom:saved'
const SEARCH_KEY = 'qsen-dom:last-search'

const app = document.querySelector('#app')
const searchInput = document.querySelector('#globalSearch')
const clearSearchButton = document.querySelector('#clearSearch')
const installButton = document.querySelector('#installButton')

const state = {
  query: localStorage.getItem(SEARCH_KEY) || '',
  saved: new Set(readSaved()),
}

let deferredInstallPrompt = null

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function persistSaved() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(state.saved)))
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const searchIndex = DOM_GUIDES.map((guide) => ({
  guide,
  text: normalize([
    guide.title,
    guide.summary,
    guide.task,
    guide.material,
    guide.tags.join(' '),
    guide.tools.join(' '),
    guide.materials.join(' '),
  ].join(' ')),
}))

function searchGuides(query) {
  const needle = normalize(query)
  if (!needle) return DOM_GUIDES

  const terms = needle.split(' ').filter(Boolean)
  return searchIndex
    .map((entry) => {
      const title = normalize(entry.guide.title)
      const tags = normalize(entry.guide.tags.join(' '))
      let score = title.includes(needle) ? 8 : 0
      score += tags.includes(needle) ? 5 : 0
      terms.forEach((term) => {
        if (entry.text.includes(term)) score += 1
      })
      return { guide: entry.guide, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.guide)
}

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (!parts.length || parts[0] === 'home') return { view: 'home' }
  if (parts[0] === 'category' && parts[1]) return { view: 'category', id: parts[1] }
  if (parts[0] === 'guide' && parts[1]) return { view: 'guide', id: parts[1] }
  if (parts[0] === 'search') return { view: 'search' }
  if (parts[0] === 'saved') return { view: 'saved' }
  if (parts[0] === 'calculator') return { view: 'calculator' }
  return { view: 'home' }
}

function activeNav(view) {
  document.querySelectorAll('[data-nav]').forEach((link) => {
    const active = link.dataset.nav === view
      || ((view === 'guide' || view === 'category') && link.dataset.nav === 'home')
    link.toggleAttribute('aria-current', active)
  })
}

function savedButton(guide, compact) {
  const saved = state.saved.has(guide.id)
  return '<button class="save-button' + (compact ? ' save-button--compact' : '') + '" type="button" data-save="' +
    escapeHtml(guide.id) + '" aria-pressed="' + saved + '" aria-label="' +
    (saved ? 'Убрать из сохранённых' : 'Сохранить инструкцию') + '">' +
    '<span aria-hidden="true">' + (saved ? '★' : '☆') + '</span>' +
    (compact ? '' : '<span>' + (saved ? 'Сохранено' : 'Сохранить') + '</span>') +
    '</button>'
}

function guideCard(guide) {
  const category = DOM_CATEGORY_BY_ID[guide.category]
  return '<article class="guide-card">' +
    '<a class="guide-card__main" href="#/guide/' + escapeHtml(guide.id) + '">' +
    '<div class="guide-card__topline"><span class="eyebrow">' + escapeHtml(category ? category.title : guide.category) +
    '</span><span class="difficulty">' + escapeHtml(guide.difficulty) + '</span></div>' +
    '<h3>' + escapeHtml(guide.title) + '</h3>' +
    '<p>' + escapeHtml(guide.summary) + '</p>' +
    '<div class="meta-row"><span>' + escapeHtml(guide.task) + '</span><span>' + escapeHtml(guide.duration) + '</span></div>' +
    '</a>' + savedButton(guide, true) + '</article>'
}

function emptyState(title, text) {
  return '<section class="empty-state"><div class="empty-state__icon" aria-hidden="true">⌕</div>' +
    '<h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(text) + '</p>' +
    '<a class="button button--primary" href="#/home">На главную</a></section>'
}

function categoryCards() {
  return DOM_CATEGORIES.map((category) => {
    const count = DOM_GUIDES.filter((guide) => guide.category === category.id).length
    return '<a class="category-card' + (count ? '' : ' category-card--planned') + '" href="#/category/' + category.id + '">' +
      '<span class="category-card__icon" aria-hidden="true">' + category.icon + '</span>' +
      '<div><strong>' + escapeHtml(category.title) + '</strong><p>' + escapeHtml(category.description) + '</p>' +
      '<small>' + (count ? count + ' материалов' : 'В плане') + '</small></div></a>'
  }).join('')
}

function homeView() {
  const quick = [
    ['П', 'Подрозетник', 'drywall-socket-box'],
    ['Д', 'Дверной проём', 'drywall-door-opening'],
    ['К', 'Каркас стены', 'drywall-partition-frame'],
    ['С', 'Крепление листов', 'drywall-sheets-fastening'],
    ['Т', 'Швы и трещины', 'drywall-joints'],
    ['В', 'Тяжёлый предмет', 'drywall-heavy-mounting'],
  ]

  return '<section class="hero">' +
    '<div><p class="hero__kicker">Справочник в кармане</p>' +
    '<h1>Ремонт по задаче, а не по тысяче вкладок</h1>' +
    '<p class="hero__lead">Выбирай, что нужно сделать, и получай инструменты, порядок работ, частые ошибки и способы исправления.</p></div>' +
    '<div class="hero__status"><strong>' + DOM_GUIDES.length + '</strong><span>рабочих черновиков</span><small>Первый раздел: гипсокартон</small></div>' +
    '</section>' +
    '<section class="section"><div class="section-heading"><div><p class="eyebrow">Быстрый вход</p><h2>Что сейчас делаешь?</h2></div></div>' +
    '<div class="task-grid">' + quick.map((item) =>
      '<a class="task-card" href="#/guide/' + item[2] + '"><span aria-hidden="true">' + item[0] + '</span><strong>' + item[1] + '</strong></a>'
    ).join('') + '</div></section>' +
    '<section class="section"><div class="section-heading"><div><p class="eyebrow">Разделы</p><h2>По материалу и системе</h2></div></div>' +
    '<div class="category-grid">' + categoryCards() + '</div></section>' +
    '<section class="section"><div class="section-heading section-heading--inline"><div><p class="eyebrow">Стартовая база</p><h2>Гипсокартон</h2></div>' +
    '<a href="#/category/drywall">Все инструкции</a></div><div class="guide-grid">' +
    DOM_GUIDES.slice(0, 6).map(guideCard).join('') + '</div></section>' +
    '<section class="principles-card"><p class="eyebrow">Логика справочника</p><h2>Задача → шаги → схема → ошибки → спасение</h2>' +
    '<p>Каждая инструкция хранится как отдельная запись. Справочник можно расширять сотнями материалов без переделки интерфейса.</p></section>'
}

function categoryView(id) {
  const category = DOM_CATEGORY_BY_ID[id]
  if (!category) return emptyState('Раздел не найден', 'Вернись на главную и выбери существующий раздел.')

  const guides = DOM_GUIDES.filter((guide) => guide.category === id)
  return '<section class="page-head"><a class="back-link" href="#/home">← Главная</a>' +
    '<span class="page-head__icon" aria-hidden="true">' + category.icon + '</span>' +
    '<p class="eyebrow">Раздел</p><h1>' + escapeHtml(category.title) + '</h1><p>' + escapeHtml(category.description) + '</p></section>' +
    (guides.length
      ? '<div class="guide-grid">' + guides.map(guideCard).join('') + '</div>'
      : '<section class="planned-card"><strong>Этот блок уже заложен в архитектуру.</strong><p>Контент появится без изменения интерфейса.</p></section>')
}

function searchView() {
  const results = searchGuides(state.query)
  const chips = ['подрозетник', 'дверь', 'профиль', 'трещина', 'минвата', 'телевизор']

  return '<section class="page-head page-head--compact"><p class="eyebrow">Локальный поиск</p>' +
    '<h1>' + (state.query ? 'Результаты: ' + escapeHtml(state.query) : 'Найди задачу своими словами') + '</h1>' +
    '<p>Поиск смотрит названия, действия, материалы, инструменты и бытовые формулировки.</p></section>' +
    '<div class="filter-strip">' + chips.map((term) =>
      '<button type="button" data-query="' + term + '">' + term + '</button>'
    ).join('') + '</div>' +
    (results.length
      ? '<p class="results-count">Найдено: ' + results.length + '</p><div class="guide-grid">' + results.map(guideCard).join('') + '</div>'
      : emptyState('Ничего не нашлось', 'Попробуй более короткий запрос.'))
}

function savedView() {
  const guides = DOM_GUIDES.filter((guide) => state.saved.has(guide.id))
  return '<section class="page-head page-head--compact"><p class="eyebrow">Локально на устройстве</p>' +
    '<h1>Сохранённые инструкции</h1><p>Рабочая подборка для текущего ремонта. Аккаунт не нужен.</p></section>' +
    (guides.length
      ? '<div class="guide-grid">' + guides.map(guideCard).join('') + '</div>'
      : emptyState('Пока пусто', 'Нажми звёздочку на инструкции, и она появится здесь.'))
}

function diagram(type) {
  if (!type) return ''
  const labels = {
    partition: ['Каркас перегородки', 'Стойки должны образовывать одну плоскость.'],
    socket: ['Подрозетник', 'До коронки найди профиль и скрытые коммуникации.'],
    door: ['Дверной проём', 'Размер считай от коробки и монтажного зазора.'],
    'find-profile': ['Поиск профиля', 'Ищи несколько точек крепежа по одной линии.'],
  }
  const item = labels[type]
  if (!item) return ''
  return '<figure class="diagram-card"><div class="diagram-schematic diagram-schematic--' + type + '" aria-hidden="true">' +
    '<span></span><span></span><span></span></div><figcaption><strong>' + item[0] + '</strong><p>' + item[1] + '</p></figcaption></figure>'
}

function list(items) {
  return '<ul>' + items.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>'
}

function guideView(id) {
  const guide = DOM_GUIDE_BY_ID[id]
  if (!guide) return emptyState('Инструкция не найдена', 'Возможно, ссылка устарела.')

  const category = DOM_CATEGORY_BY_ID[guide.category]
  const related = DOM_GUIDES
    .filter((item) => item.id !== guide.id && item.category === guide.category)
    .slice(0, 3)

  return '<article class="guide-detail">' +
    '<a class="back-link" href="#/category/' + guide.category + '">← ' + escapeHtml(category ? category.title : 'Раздел') + '</a>' +
    '<header class="guide-hero"><div class="guide-hero__copy"><p class="eyebrow">' +
    escapeHtml(category ? category.title : guide.category) + ' · ' + escapeHtml(guide.task) + '</p>' +
    '<h1>' + escapeHtml(guide.title) + '</h1><p class="guide-hero__lead">' + escapeHtml(guide.summary) + '</p>' +
    '<div class="guide-badges"><span>' + escapeHtml(guide.difficulty) + '</span><span>' + escapeHtml(guide.duration) +
    '</span><span>' + escapeHtml(guide.material) + '</span></div></div>' + savedButton(guide, false) + '</header>' +
    diagram(guide.diagram) +
    '<section class="guide-columns"><div class="check-card"><p class="eyebrow">Инструменты</p>' + list(guide.tools) + '</div>' +
    '<div class="check-card"><p class="eyebrow">Материалы</p>' +
    (guide.materials.length ? list(guide.materials) : '<p>Отдельные материалы не нужны.</p>') + '</div></section>' +
    '<section class="warning-card"><p class="eyebrow">Перед началом</p>' + list(guide.before) + '</section>' +
    '<section class="steps-section"><div class="section-heading"><div><p class="eyebrow">Пошагово</p><h2>Делай по порядку</h2></div></div>' +
    '<ol class="steps-list">' + guide.steps.map((step, index) =>
      '<li class="step-card"><span class="step-number">' + (index + 1) + '</span><div><h3>' + escapeHtml(step.title) +
      '</h3><p>' + escapeHtml(step.text) + '</p></div></li>'
    ).join('') + '</ol></section>' +
    '<section class="problem-grid"><div class="problem-card problem-card--mistake"><p class="eyebrow">Частые ошибки</p>' +
    list(guide.mistakes) + '</div><div class="problem-card problem-card--rescue"><p class="eyebrow">Если уже сделал</p><p>' +
    escapeHtml(guide.rescue) + '</p></div></section>' +
    '<section class="verification-card"><strong>Статус материала: рабочий черновик.</strong><p>' +
    escapeHtml(guide.verification) + '</p></section>' +
    (related.length
      ? '<section class="section"><div class="section-heading"><div><p class="eyebrow">Дальше по теме</p><h2>Связанные инструкции</h2></div></div>' +
        '<div class="guide-grid">' + related.map(guideCard).join('') + '</div></section>'
      : '') +
    '</article>'
}

function calculatorView() {
  return '<section class="page-head page-head--compact"><p class="eyebrow">Первый калькулятор</p>' +
    '<h1>Черновой расчёт перегородки</h1><p>Ориентир для закупки. Проёмы, раскладку и требования системы надо считать отдельно.</p></section>' +
    '<form class="calculator-card" id="partitionCalculator"><div class="field-grid">' +
    '<label><span>Ширина стены, м</span><input name="width" type="number" min="0.5" max="50" step="0.1" value="3.6" required></label>' +
    '<label><span>Высота стены, м</span><input name="height" type="number" min="1" max="10" step="0.1" value="2.7" required></label>' +
    '<label><span>Шаг стоек, м</span><select name="spacing"><option value="0.6">0,60</option><option value="0.4">0,40</option></select></label>' +
    '<label><span>Слоёв ГКЛ с каждой стороны</span><select name="layers"><option value="1">1 слой</option><option value="2">2 слоя</option></select></label>' +
    '</div><button class="button button--primary" type="submit">Посчитать</button>' +
    '<p class="form-note">Лист условно 1200 × 2500 мм. В расчёт добавлен запас 10%.</p></form>' +
    '<section id="calculatorResult" class="calculator-result" aria-live="polite"><p>Заполни размеры и нажми «Посчитать».</p></section>'
}

function calculate(form) {
  const data = new FormData(form)
  const width = Number(data.get('width'))
  const height = Number(data.get('height'))
  const spacing = Number(data.get('spacing'))
  const layers = Number(data.get('layers'))
  if (![width, height, spacing, layers].every(Number.isFinite) || width <= 0 || height <= 0) return

  const wallArea = width * height
  const sheets = Math.ceil((wallArea * 2 * layers * 1.1) / (1.2 * 2.5))
  const studCount = Math.ceil(width / spacing) + 1
  const trackLength = width * 2 * 1.1
  const studLength = studCount * height * 1.05
  const insulationArea = wallArea * 1.05
  const target = document.querySelector('#calculatorResult')
  if (!target) return

  target.innerHTML = '<p class="eyebrow">Ориентировочно</p><div class="result-grid">' +
    '<div><strong>' + sheets + '</strong><span>листов ГКЛ 1200 × 2500</span></div>' +
    '<div><strong>' + trackLength.toFixed(1) + ' м</strong><span>направляющего профиля</span></div>' +
    '<div><strong>' + studCount + ' шт.</strong><span>стоек по ' + height.toFixed(1) + ' м</span></div>' +
    '<div><strong>' + studLength.toFixed(1) + ' м</strong><span>стоечного профиля суммарно</span></div>' +
    '<div><strong>' + insulationArea.toFixed(1) + ' м²</strong><span>заполнения с запасом</span></div></div>' +
    '<p class="form-note">Пересчитай итог под реальные длины профилей, двери, усиления и раскладку листов.</p>'
}

function render() {
  const current = route()
  activeNav(current.view)

  if (current.view === 'home') app.innerHTML = homeView()
  if (current.view === 'category') app.innerHTML = categoryView(current.id)
  if (current.view === 'search') app.innerHTML = searchView()
  if (current.view === 'saved') app.innerHTML = savedView()
  if (current.view === 'guide') app.innerHTML = guideView(current.id)
  if (current.view === 'calculator') app.innerHTML = calculatorView()

  const guide = current.view === 'guide' ? DOM_GUIDE_BY_ID[current.id] : null
  document.title = guide ? guide.title + ' - Дом' : 'Дом - справочник по ремонту и строительству'
  requestAnimationFrame(() => app.focus({ preventScroll: true }))
}

function syncSearch() {
  searchInput.value = state.query
  clearSearchButton.hidden = !state.query
}

searchInput.addEventListener('input', (event) => {
  state.query = event.currentTarget.value
  localStorage.setItem(SEARCH_KEY, state.query)
  syncSearch()
  if (route().view !== 'search') location.hash = '#/search'
  else render()
})

clearSearchButton.addEventListener('click', () => {
  state.query = ''
  localStorage.removeItem(SEARCH_KEY)
  syncSearch()
  searchInput.focus()
  if (route().view !== 'search') location.hash = '#/search'
  else render()
})

document.addEventListener('click', (event) => {
  const save = event.target.closest('[data-save]')
  if (save) {
    event.preventDefault()
    const id = save.dataset.save
    if (state.saved.has(id)) state.saved.delete(id)
    else state.saved.add(id)
    persistSaved()
    render()
    return
  }

  const query = event.target.closest('[data-query]')
  if (query) {
    state.query = query.dataset.query || ''
    localStorage.setItem(SEARCH_KEY, state.query)
    syncSearch()
    render()
  }
})

document.addEventListener('submit', (event) => {
  if (!event.target.matches('#partitionCalculator')) return
  event.preventDefault()
  calculate(event.target)
})

window.addEventListener('hashchange', render)

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferredInstallPrompt = event
  installButton.hidden = false
})

installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return
  deferredInstallPrompt.prompt()
  await deferredInstallPrompt.userChoice
  deferredInstallPrompt = null
  installButton.hidden = true
})

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null
  installButton.hidden = true
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((error) => {
      console.warn('Dom service worker registration failed:', error)
    })
  })
}

syncSearch()
if (!location.hash) location.replace('#/home')
render()
