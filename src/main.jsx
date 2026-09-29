import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/commissioner/wght.css'
import '@fontsource-variable/unbounded/wght.css'
import 'iconoir/css/iconoir.css'
import { DOM_CATEGORIES, DOM_GUIDES, DOM_CATEGORY_BY_ID, DOM_GUIDE_BY_ID, DOM_ROOMS, DOM_SURFACE_FAMILIES, DOM_JOINT_TYPES, DOM_BASEBOARD_TYPES } from '../content.js'
import { getLemanaShopping, getGuidePracticalDetail, getMaterialSearchUrl } from '../guide-enrichment.js'
import './styles.css'
import PlannerPage from './planner.jsx'

const STORAGE_KEY = 'qsen-dom:saved'
const SEARCH_KEY = 'qsen-dom:last-search'
const PROJECT_KEY = 'qsen-dom:project-progress'

const IMAGES = {
  hero: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=2200&q=88',
  apartment: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=85',
  bathroom: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=85',
  kitchen: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=85',
  electrical: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=85',
  tools: 'https://images.unsplash.com/photo-1581147036324-c1c89c2c8b5c?auto=format&fit=crop&w=1200&q=85',
  drywall: 'https://images.unsplash.com/photo-1590725121839-892b458a74fe?auto=format&fit=crop&w=1200&q=85',
  wood: 'https://images.unsplash.com/photo-1531835551805-16d864c8d311?auto=format&fit=crop&w=1200&q=85',
  room: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=85',
}

const CATEGORY_IMAGE_BY_ID = {
  planning: IMAGES.tools,
  construction: IMAGES.hero,
  drywall: IMAGES.drywall,
  ceilings: IMAGES.room,
  floors: IMAGES.wood,
  electrics: IMAGES.electrical,
  plumbing: IMAGES.bathroom,
  heating: IMAGES.room,
  ventilation: IMAGES.tools,
  'windows-doors': IMAGES.apartment,
  finishing: IMAGES.kitchen,
  surfaces: IMAGES.wood,
  roof: IMAGES.hero,
  site: IMAGES.apartment,
}

const CATEGORY_ART = DOM_CATEGORIES.map((category) => CATEGORY_IMAGE_BY_ID[category.id] || IMAGES.tools)

const NavigationContext = createContext(null)

function parseRoute(hash = window.location.hash) {
  const bits = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (!bits.length || bits[0] === 'home') return { view: 'home', key: 'home' }
  if (bits[0] === 'category' && bits[1]) return { view: 'category', id: bits[1], key: `category-${bits[1]}` }
  if (bits[0] === 'guide' && bits[1]) return { view: 'guide', id: bits[1], key: `guide-${bits[1]}` }
  if (['catalog', 'search', 'calculator', 'planner', 'saved', 'project'].includes(bits[0])) return { view: bits[0], key: bits[0] }
  return { view: 'home', key: 'home' }
}

function NavigationProvider({ children }) {
  const [route, setRoute] = useState(() => parseRoute())

  useEffect(() => {
    const update = () => setRoute(parseRoute())
    window.addEventListener('hashchange', update)
    window.addEventListener('popstate', update)
    if (!window.location.hash) history.replaceState(null, '', '#/home')
    return () => {
      window.removeEventListener('hashchange', update)
      window.removeEventListener('popstate', update)
    }
  }, [])

  const navigate = useCallback((href) => {
    if (!href?.startsWith('#/')) return
    if (href === window.location.hash) return
    const commit = () => {
      history.pushState(null, '', href)
      setRoute(parseRoute(href))
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(commit)
    } else {
      commit()
    }
  }, [])

  return <NavigationContext.Provider value={{ route, navigate }}>{children}</NavigationContext.Provider>
}

function useNavigation() {
  return useContext(NavigationContext)
}

function Link({ href, className = '', children, onClick, ...props }) {
  const { navigate } = useNavigation()
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
        if (href?.startsWith('#/')) {
          event.preventDefault()
          navigate(href)
        }
      }}
      {...props}
    >
      {children}
    </a>
  )
}

const ICON_NAMES = {
  home: 'home-alt-slim',
  grid: 'component',
  search: 'input-search',
  calc: 'calculator',
  bookmark: 'bookmark-book',
  hammer: 'hammer',
  arrow: 'arrow-right',
  spark: 'circle-spark',
  play: 'play',
  layers: 'book-stack',
  cube: 'cube',
  ruler: 'ruler-combine',
  bulb: 'light-bulb-on',
  menu: 'menu-scale',
  close: 'xmark',
  chevron: 'nav-arrow-right',
  check: 'check-circle',
  warning: 'warning-triangle',
  clock: 'clock',
  heart: 'heart',
  project: 'project-curve-3d',
  user: 'profile-circle',
  mic: 'microphone-speaking',
}

const ROOM_ICON_NAMES = {
  kitchen: 'layers',
  bathroom: 'spark',
  toilet: 'home',
  hall: 'project',
  living: 'home',
  bedroom: 'home',
  kids: 'spark',
  office: 'grid',
  laundry: 'layers',
  balcony: 'project',
  utility: 'hammer',
}

function RoomIcon({ id, size = 18 }) {
  return <Icon name={ROOM_ICON_NAMES[id] || 'home'} size={size} />
}

function Icon({ name, size = 20, className = '' }) {
  return (
    <i
      className={`dom-icon iconoir-${ICON_NAMES[name] || ICON_NAMES.grid} ${className}`}
      style={{ fontSize: size }}
      aria-hidden="true"
    />
  )
}

function Logo({ compact = false }) {
  return (
    <Link href="#/home" className={`logo ${compact ? 'logo--compact' : ''}`} aria-label="Дом — на главную">
      <span className="logo__mark" aria-hidden="true">
        <i className="logo__roof" />
        <i className="logo__wall" />
        <i className="logo__axis" />
      </span>
      <span className="logo__copy"><strong>ДОМ</strong>{!compact && <small>практика ремонта</small>}</span>
    </Link>
  )
}

function useReveal(routeKey) {
  useEffect(() => {
    const nodes = [...document.querySelectorAll('[data-reveal]')]
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((node) => node.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' })
    nodes.forEach((node, i) => {
      node.style.setProperty('--reveal-delay', `${Math.min(i * 34, 240)}ms`)
      observer.observe(node)
    })
    return () => observer.disconnect()
  }, [routeKey])
}

function useScrollProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const total = document.documentElement.scrollHeight - window.innerHeight
      setProgress(total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    return () => {
      removeEventListener('scroll', onScroll)
      removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return progress
}

function useTilt() {
  const ref = useRef(null)
  const onPointerMove = (event) => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width - 0.5
    const py = (event.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty('--rx', `${py * -4}deg`)
    el.style.setProperty('--ry', `${px * 5}deg`)
    el.style.setProperty('--mx', `${(px + 0.5) * 100}%`)
    el.style.setProperty('--my', `${(py + 0.5) * 100}%`)
  }
  const onPointerLeave = () => {
    if (!ref.current) return
    ref.current.style.setProperty('--rx', '0deg')
    ref.current.style.setProperty('--ry', '0deg')
  }
  return { ref, onPointerMove, onPointerLeave }
}

function TiltCard({ children, className = '', ...props }) {
  const tilt = useTilt()
  return <div className={`tilt ${className}`} {...tilt} {...props}>{children}</div>
}

function MagneticButton({ href, children, className = '', icon = true }) {
  const ref = useRef(null)
  const onMove = (event) => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const el = ref.current
    const rect = el.getBoundingClientRect()
    const x = (event.clientX - rect.left - rect.width / 2) * 0.09
    const y = (event.clientY - rect.top - rect.height / 2) * 0.12
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }
  const reset = () => { if (ref.current) ref.current.style.transform = '' }
  return <Link href={href} className={`magnetic ${className}`}><span ref={ref} onPointerMove={onMove} onPointerLeave={reset}>{children}{icon && <Icon name="arrow" size={17} />}</span></Link>
}

function SearchField({ query, setQuery, compact = false, autoNavigate = true, onSubmit }) {
  const { navigate } = useNavigation()
  return (
    <form className={`search-field ${compact ? 'search-field--compact' : ''}`} onSubmit={(event) => {
      event.preventDefault()
      onSubmit?.()
      if (autoNavigate) navigate('#/search')
    }}>
      <Icon name="search" size={compact ? 17 : 20} />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={compact ? 'Поиск по справочнику…' : 'Например: как установить подрозетник?'} aria-label="Поиск" />
      {!compact && <kbd>⌘ K</kbd>}
    </form>
  )
}

function Header({ query, setQuery, openPalette }) {
  const { route } = useNavigation()
  const progress = useScrollProgress()
  const [mobileMenu, setMobileMenu] = useState(false)
  return (
    <>
      <header className="site-header">
        <div className="header-progress" style={{ transform: `scaleX(${progress})` }} />
        <div className="header-inner">
          <Logo />
          <nav className="desktop-nav" aria-label="Разделы сайта">
            <Link href="#/project" className={route.view === 'project' ? 'active' : ''}>Проекты</Link>
            <Link href="#/catalog" className={['catalog', 'category', 'guide'].includes(route.view) ? 'active' : ''}>База знаний</Link>
            <Link href="#/calculator" className={route.view === 'calculator' ? 'active' : ''}>Калькуляторы</Link>
            <Link href="#/planner" className={route.view === 'planner' ? 'active' : ''}>3D планировщик</Link>
            <Link href="#/catalog">Материалы</Link>
            <Link href="#/saved">Идеи</Link>
          </nav>
          <div className="header-actions">
            <button className="icon-button search-trigger" type="button" onClick={openPalette} aria-label="Открыть поиск"><Icon name="search" /></button>
            <Link href="#/saved" className="icon-button" aria-label="Сохранённое"><Icon name="bookmark" /></Link>
            <Link href="#/project" className="avatar" aria-label="Мой проект">A</Link>
            <button className="mobile-menu-button" type="button" onClick={() => setMobileMenu((v) => !v)} aria-expanded={mobileMenu} aria-label="Меню"><Icon name={mobileMenu ? 'close' : 'menu'} /></button>
          </div>
        </div>
      </header>
      <div className={`mobile-drawer ${mobileMenu ? 'open' : ''}`} aria-hidden={!mobileMenu}>
        <SearchField query={query} setQuery={setQuery} compact onSubmit={() => setMobileMenu(false)} />
        <Link href="#/project" onClick={() => setMobileMenu(false)}>Проекты <Icon name="chevron" /></Link>
        <Link href="#/catalog" onClick={() => setMobileMenu(false)}>База знаний <Icon name="chevron" /></Link>
        <Link href="#/calculator" onClick={() => setMobileMenu(false)}>Калькуляторы <Icon name="chevron" /></Link>
        <Link href="#/planner" onClick={() => setMobileMenu(false)}>3D планировщик <Icon name="chevron" /></Link>
        <Link href="#/saved" onClick={() => setMobileMenu(false)}>Сохранённое <Icon name="chevron" /></Link>
      </div>
    </>
  )
}

function Hero({ query, setQuery }) {
  return (
    <section className="hero-premium" data-reveal>
      <div className="hero-premium__media" style={{ backgroundImage: `url(${IMAGES.hero})` }} />
      <div className="hero-premium__shade" />
      <div className="hero-premium__grain" />
      <div className="hero-premium__content">
        <span className="eyebrow-dark">Всё для строительства и ремонта</span>
        <h1>Планируй.<br />Строй.<br /><em>Воплощай.</em></h1>
        <p>Пошаговые гайды, калькуляторы, подбор материалов, реальные примеры и советы от практиков. Всё в одном месте.</p>
        <div className="hero-premium__buttons">
          <MagneticButton href="#/project" className="button-primary">Создать проект</MagneticButton>
          <Link href="#/guide/drywall-partition-frame" className="button-glass"><Icon name="play" size={17} /> Как это работает?</Link>
        </div>
        <div className="hero-search-mobile"><SearchField query={query} setQuery={setQuery} /></div>
      </div>
      <TiltCard className="hero-project-card">
        <div className="hero-project-card__image" style={{ backgroundImage: `url(${IMAGES.apartment})` }} />
        <div className="hero-project-card__body">
          <small>Мой проект</small>
          <strong>Ремонт квартиры 60 м²</strong>
          <div className="project-stage"><span>Этап: чистовая отделка</span><b>68%</b></div>
          <div className="progress"><i style={{ width: '68%' }} /></div>
          <div className="project-team"><span>A</span><span>М</span><span>И</span><span>+12</span><Link href="#/project"><Icon name="arrow" size={17} /></Link></div>
        </div>
      </TiltCard>
      <div className="hero-stats">
        <div><strong>{DOM_GUIDES.length}</strong><span>инструкций</span></div>
        <div><strong>{DOM_CATEGORIES.length}</strong><span>главных разделов</span></div>
        <div><strong>1</strong><span>калькулятор</span></div>
        <div><strong>∞</strong><span>идей для дома</span></div>
      </div>
    </section>
  )
}

function QuickTools() {
  const tools = [
    ['project', '3D планировщик', 'План, стены и помещения', '#/planner'],
    ['calc', 'Калькуляторы', 'Быстрые расчёты', '#/calculator'],
    ['layers', 'Материалы', 'Подбор и нормы', '#/catalog'],
    ['check', 'Чек-листы', 'Работа по шагам', '#/guide/drywall-partition-frame'],
  ]
  return (
    <section className="quick-tools" data-reveal>
      {tools.map(([icon, title, subtitle, href]) => (
        <Link key={title} href={href} className="quick-tool">
          <span><Icon name={icon} /></span>
          <div><strong>{title}</strong><small>{subtitle}</small></div>
          <Icon name="chevron" size={16} />
        </Link>
      ))}
    </section>
  )
}

function PopularSections() {
  const popularIds = ['construction', 'drywall', 'ceilings', 'floors', 'electrics', 'plumbing']
  const popular = popularIds
    .map((id) => DOM_CATEGORY_BY_ID[id])
    .filter(Boolean)
    .map((category) => ({
      ...category,
      count: DOM_GUIDES.filter((guide) => guide.category === category.id).length,
    }))

  return (
    <section className="content-section popular-section" data-reveal>
      <div className="section-title-row"><div><span className="overline">Навигация по задачам</span><h2>Популярные разделы</h2></div><Link href="#/catalog">Смотреть все <Icon name="arrow" size={16} /></Link></div>
      <div className="popular-scroll">
        {popular.map((item) => (
          <TiltCard className="popular-card" key={item.id}>
            <Link href={`#/category/${item.id}`}>
              <img src={CATEGORY_IMAGE_BY_ID[item.id] || IMAGES.tools} alt="" loading="lazy" />
              <span className="popular-card__overlay" />
              <div><strong>{item.title}</strong><small>{item.count} инструкций</small></div>
              <b><Icon name="arrow" size={16} /></b>
            </Link>
          </TiltCard>
        ))}
      </div>
    </section>
  )
}

function KnowledgePreview() {
  const guide = DOM_GUIDE_BY_ID['drywall-socket-box'] || DOM_GUIDES[0]
  if (!guide) return null
  return (
    <section className="split-showcase" data-reveal>
      <div className="showcase-copy">
        <span className="overline">Инструкция, а не статья ради статьи</span>
        <h2>От вопроса — сразу к правильному действию</h2>
        <p>На объекте не нужен учебник на сорок страниц. Нужен порядок: что проверить, чем сделать, в какой последовательности и что будет, если уже ошибся.</p>
        <div className="feature-list">
          <div><span>01</span><strong>Пошагово</strong><small>Каждый этап отдельно</small></div>
          <div><span>02</span><strong>Безопасно</strong><small>Предупреждения до начала работ</small></div>
          <div><span>03</span><strong>Практично</strong><small>Ошибки и способы исправления</small></div>
        </div>
        <MagneticButton href={`#/guide/${guide.id}`} className="button-dark">Открыть инструкцию</MagneticButton>
      </div>
      <TiltCard className="instruction-preview">
        <div className="instruction-preview__top">
          <span className="status-dot">Проверено структурой</span>
          <span><Icon name="clock" size={15} /> {guide.duration}</span>
        </div>
        <h3>{guide.title}</h3>
        <p>{guide.summary}</p>
        <div className="instruction-visual" style={{ backgroundImage: `url(${IMAGES.drywall})` }}>
          <button aria-label="Воспроизвести"><Icon name="play" /></button>
          <div className="visual-callout">Проверьте, чтобы коронка была на одном уровне</div>
        </div>
        <div className="preview-steps">
          {guide.steps.slice(0, 4).map((step, i) => <div key={step.title}><span>{i + 1}</span><strong>{step.title}</strong><Icon name={i === 0 ? 'check' : 'chevron'} size={16} /></div>)}
        </div>
      </TiltCard>
    </section>
  )
}

function ProjectShowcase() {
  return (
    <section className="project-showcase" data-reveal>
      <div className="section-title-row light"><div><span className="overline">Проект в одном месте</span><h2>Ремонт квартиры 60 м²</h2><p>План, этапы, покупки, бюджет и заметки — привязаны к реальным комнатам.</p></div><MagneticButton href="#/project" className="button-light">Открыть проект</MagneticButton></div>
      <div className="project-shell">
        <aside className="project-sidebar">
          <Logo compact />
          {['Обзор', 'Этапы', 'План помещений', 'Список покупок', 'Калькуляторы', 'Документы', 'Заметки', 'Бюджет'].map((item, i) => <div className={i === 1 ? 'active' : ''} key={item}><Icon name={i === 2 ? 'project' : i === 3 ? 'check' : i === 4 ? 'calc' : 'grid'} size={17} />{item}</div>)}
        </aside>
        <div className="project-canvas-wrap">
          <div className="project-canvas-head"><div><small>Мой проект</small><strong>Ремонт квартиры 60 м²</strong></div><div className="project-canvas-progress"><span>Чистовая отделка</span><div className="progress"><i style={{ width: '68%' }} /></div><b>68%</b></div></div>
          <FloorPlan />
        </div>
        <aside className="rooms-panel">
          <div className="rooms-tabs"><button>Этажи</button><button>2D план</button><button className="active">3D вид</button></div>
          <FloorPlan compact />
          <strong>Список помещений</strong>
          {[
            ['Гостиная', '18.2 м²'], ['Кухня', '10.4 м²'], ['Спальня', '12.5 м²'], ['Ванная', '4.8 м²'], ['Прихожая', '6.1 м²'], ['Балкон', '3.6 м²'],
          ].map(([room, area]) => <div className="room-row" key={room}><i style={{ backgroundImage: `url(${room === 'Ванная' ? IMAGES.bathroom : room === 'Кухня' ? IMAGES.kitchen : IMAGES.apartment})` }} /><span><b>{room}</b><small>{area}</small></span><Icon name="chevron" size={14} /></div>)}
        </aside>
      </div>
    </section>
  )
}

function FloorPlan({ compact = false }) {
  return (
    <div className={'floor-plan ' + (compact ? 'floor-plan--compact' : '')} aria-label="Архитектурный план квартиры">
      <svg className="floor-plan-svg" viewBox="0 0 760 540" role="img" aria-label="План квартиры с помещениями, дверями, окнами и мебелью">
        <defs>
          <pattern id="fp-wood" width="58" height="18" patternUnits="userSpaceOnUse">
            <rect width="58" height="18" fill="#ded3bd" />
            <path d="M0 0H58M0 18H58M29 0V18" stroke="#c4b79d" strokeWidth="1" opacity=".55" />
          </pattern>
          <pattern id="fp-tile" width="30" height="30" patternUnits="userSpaceOnUse">
            <rect width="30" height="30" fill="#d9dedb" />
            <path d="M30 0H0V30" fill="none" stroke="#bcc6c2" strokeWidth="1" />
          </pattern>
          <pattern id="fp-stone" width="42" height="42" patternUnits="userSpaceOnUse">
            <rect width="42" height="42" fill="#d9cdb9" />
            <path d="M0 21H42M21 0V42" stroke="#c8b9a1" strokeWidth=".8" opacity=".55" />
          </pattern>
          <filter id="fp-shadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="12" stdDeviation="13" floodColor="#141712" floodOpacity=".15" />
          </filter>
        </defs>

        <g filter="url(#fp-shadow)">
          <path className="fp-slab" d="M42 42H682V426H700V508H360V426H42Z" />
          <rect className="fp-room-fill" x="52" y="52" width="188" height="208" fill="url(#fp-wood)" />
          <rect className="fp-room-fill" x="240" y="52" width="262" height="208" fill="url(#fp-wood)" />
          <rect className="fp-room-fill" x="502" y="52" width="168" height="364" fill="url(#fp-stone)" />
          <rect className="fp-room-fill" x="52" y="260" width="188" height="156" fill="url(#fp-tile)" />
          <rect className="fp-room-fill" x="240" y="260" width="262" height="156" fill="url(#fp-stone)" />
          <rect className="fp-room-fill" x="370" y="416" width="320" height="82" fill="url(#fp-stone)" />

          <g className="fp-walls">
            <path d="M47 47H675V421H695V503H365V421H47Z" />
            <path d="M240 47V421M502 47V421M47 260H502M365 421V503" />
          </g>

          <g className="fp-windows">
            <path d="M105 47H184M300 47H405M675 112V202" />
            <path d="M105 42H184M300 42H405M680 112V202" />
          </g>

          <g className="fp-doors">
            <path className="fp-door-cut" d="M240 164V222M502 292V350M167 260H220M365 421H423" />
            <path className="fp-door-leaf" d="M240 164H182M502 292H444M167 260V313M365 421V479" />
            <path className="fp-door-swing" d="M240 222A58 58 0 0 0 182 164M502 350A58 58 0 0 0 444 292M220 260A53 53 0 0 1 167 313M423 421A58 58 0 0 0 365 479" />
          </g>

          <g className="fp-furniture">
            <g className="fp-bed">
              <rect x="82" y="92" width="126" height="108" rx="10" />
              <rect x="92" y="104" width="48" height="28" rx="6" />
              <rect x="150" y="104" width="48" height="28" rx="6" />
              <path d="M82 144H208" />
            </g>
            <g className="fp-sofa">
              <rect x="300" y="144" width="142" height="52" rx="13" />
              <path d="M318 144V196M424 144V196M300 166H442" />
            </g>
            <g className="fp-bath">
              <rect x="80" y="292" width="126" height="70" rx="30" />
              <circle cx="185" cy="327" r="5" />
              <rect x="79" y="376" width="58" height="25" rx="5" />
            </g>
            <g className="fp-kitchen">
              <path d="M528 78H646V112H562V235H528Z" />
              <circle cx="610" cy="300" r="38" />
              <circle cx="610" cy="300" r="12" />
              <path d="M610 250V236M610 364V350M560 300H546M674 300H660" />
            </g>
            <g className="fp-hall">
              <rect x="286" y="294" width="90" height="34" rx="6" />
              <path d="M286 339H450" />
            </g>
          </g>

          <g className="fp-labels">
            <g transform="translate(145 226)"><text>Спальня</text><text className="fp-area" y="17">12.5 м²</text></g>
            <g transform="translate(370 226)"><text>Гостиная</text><text className="fp-area" y="17">18.2 м²</text></g>
            <g transform="translate(145 391)"><text>Ванная</text><text className="fp-area" y="17">4.8 м²</text></g>
            <g transform="translate(370 391)"><text>Прихожая</text><text className="fp-area" y="17">6.1 м²</text></g>
            <g transform="translate(586 385)"><text>Кухня</text><text className="fp-area" y="17">10.4 м²</text></g>
            <g transform="translate(527 478)"><text>Балкон</text><text className="fp-area" y="17">3.6 м²</text></g>
          </g>

          <g className="fp-dimensions">
            <path d="M52 24V37M240 24V37M52 30H240" />
            <text x="146" y="25" textAnchor="middle">3.4 м</text>
            <path d="M25 52H38M25 260H38M31 52V260" />
            <text x="22" y="160" textAnchor="middle" transform="rotate(-90 22 160)">3.8 м</text>
          </g>
        </g>
      </svg>
    </div>
  )
}

function HomePage({ query, setQuery }) {
  return <>
    <Hero query={query} setQuery={setQuery} />
    <div className="home-body">
      <QuickTools />
      <PopularSections />
      <KnowledgePreview />
      <ProjectShowcase />
    </div>
  </>
}

function RoomExplorer() {
  const [roomId, setRoomId] = useState(DOM_ROOMS[0]?.id || '')
  const room = DOM_ROOMS.find((item) => item.id === roomId) || DOM_ROOMS[0]
  if (!room) return null

  const surfaceById = Object.fromEntries(DOM_SURFACE_FAMILIES.map((item) => [item.id, item]))
  const baseboardById = Object.fromEntries(DOM_BASEBOARD_TYPES.map((item) => [item.id, item]))
  const recommendedGuides = room.guideIds.map((id) => DOM_GUIDE_BY_ID[id]).filter(Boolean)

  const SurfacePills = ({ ids, kind }) => (
    <div className="room-material-list">
      {ids.map((id) => {
        const surface = surfaceById[id]
        if (!surface) return null
        return <span className={`room-material room-material--${kind}`} key={id}><b>{surface.title}</b><small>{surface.summary}</small></span>
      })}
    </div>
  )

  return (
    <section className="room-explorer" data-reveal>
      <div className="room-explorer__head">
        <div><span className="overline">Подбор по помещению</span><h2>Сначала выберите комнату</h2><p>Ванная и спальня не должны получать одинаковую отделку. Здесь рекомендации завязаны на воду, трафик, уборку, акустику и ремонтопригодность.</p></div>
        <Link href="#/category/surfaces">Все покрытия и стыки <Icon name="arrow" size={16} /></Link>
      </div>
      <div className="room-tabs" role="tablist" aria-label="Помещения">
        {DOM_ROOMS.map((item) => <button type="button" role="tab" aria-selected={item.id === room.id} className={item.id === room.id ? 'active' : ''} onClick={() => setRoomId(item.id)} key={item.id}><span><RoomIcon id={item.id} size={17} /></span>{item.title}</button>)}
      </div>
      <div className="room-board">
        <aside className="room-board__summary">
          <span className="room-board__icon"><RoomIcon id={room.id} size={25} /></span>
          <div><small>Помещение</small><h3>{room.title}</h3></div>
          <strong>Главные нагрузки</strong>
          <div className="room-demands">{room.demands.map((item) => <span key={item}>{item}</span>)}</div>
          <strong>Неудачные сценарии</strong>
          <ul>{room.avoid.map((item) => <li key={item}>{item}</li>)}</ul>
          <div className="room-paint-note"><Icon name="spark" size={17} /><p><b>Краска:</b> {room.paint}</p></div>
        </aside>
        <div className="room-board__materials">
          <div className="room-material-section"><div className="room-material-section__title"><span>01</span><div><strong>Пол</strong><small>{room.floors.length} подходящих семейств</small></div></div><SurfacePills ids={room.floors} kind="floor" /></div>
          <div className="room-material-section"><div className="room-material-section__title"><span>02</span><div><strong>Стены</strong><small>{room.walls.length} вариантов отделки</small></div></div><SurfacePills ids={room.walls} kind="wall" /></div>
          <div className="room-material-section room-material-section--compact">
            <div className="room-material-section__title"><span>03</span><div><strong>Плинтусы</strong><small>по условиям комнаты</small></div></div>
            <div className="baseboard-pills">{room.baseboards.map((id) => <span key={id}>{baseboardById[id]?.title || id}</span>)}</div>
          </div>
          <div className="room-material-section room-material-section--compact">
            <div className="room-material-section__title"><span>04</span><div><strong>Стыки</strong><small>узлы, которые надо решить заранее</small></div></div>
            <div className="baseboard-pills">{room.joints.map((id) => <span key={id}>{DOM_JOINT_TYPES.find((item) => item.id === id)?.title || id}</span>)}</div>
          </div>
        </div>
      </div>
      <div className="room-guides">
        <span>Инструкции по этой комнате</span>
        {recommendedGuides.map((guide) => <Link href={`#/guide/${guide.id}`} key={guide.id}><strong>{guide.title}</strong><Icon name="arrow" size={15} /></Link>)}
      </div>
    </section>
  )
}

function SurfaceAtlas() {
  const floorCount = DOM_SURFACE_FAMILIES.filter((item) => item.kind.includes('floor')).length
  const wallCount = DOM_SURFACE_FAMILIES.filter((item) => item.kind.includes('wall')).length
  return (
    <section className="surface-atlas" data-reveal>
      <div className="section-title-row"><div><span className="overline">Энциклопедия материалов</span><h2>Покрытия, стыки и плинтусы</h2></div><Link href="#/category/surfaces">Открыть узлы <Icon name="arrow" size={16} /></Link></div>
      <div className="surface-atlas__stats">
        <Link href="#/category/floors"><span>{floorCount}</span><strong>типов покрытий пола</strong><small>от дерева и пробки до LVT, резины и смоляных систем</small></Link>
        <Link href="#/category/finishing"><span>{wallCount}</span><strong>типов покрытий стен</strong><small>краски, обои, панели, камень, микроцемент и фактуры</small></Link>
        <Link href="#/category/surfaces"><span>{DOM_JOINT_TYPES.length}</span><strong>типов стыков</strong><small>в один уровень, с перепадом, деформационные и эластичные</small></Link>
        <Link href="#/category/surfaces"><span>{DOM_BASEBOARD_TYPES.length}</span><strong>типов плинтусов</strong><small>MDF, дерево, полимер, металл, скрытые и санитарные</small></Link>
      </div>
    </section>
  )
}

function CatalogPage() {
  return (
    <main className="page page--paper catalog-page">
      <PageIntro eyebrow="База знаний" title="Разделы" text="Выберите тему или конкретное помещение. Справочник связывает материалы, условия эксплуатации, стыки и технологию монтажа." />
      <div className="catalog-search-row"><Link href="#/search" className="catalog-search"><Icon name="search" /> Поиск по разделам, статьям, материалам…</Link><div className="chips"><span className="active">Все</span><span>Статьи</span><span>Материалы</span></div></div>
      <RoomExplorer />
      <SurfaceAtlas />
      <div className="section-title-row catalog-sections-title"><div><span className="overline">Все направления</span><h2>Разделы справочника</h2></div></div>
      <div className="category-gallery">
        {DOM_CATEGORIES.map((category, i) => {
          const count = DOM_GUIDES.filter((guide) => guide.category === category.id).length
          return (
            <TiltCard className="category-photo" key={category.id} data-reveal>
              <Link href={`#/category/${category.id}`}>
                <img src={CATEGORY_IMAGE_BY_ID[category.id] || CATEGORY_ART[i % CATEGORY_ART.length]} alt="" loading="lazy" />
                <div className="category-photo__shade" />
                <div><strong>{category.title}</strong><small>{count ? `${count} инструкций` : 'Раздел готовится'}</small></div>
                <span><Icon name="arrow" size={16} /></span>
              </Link>
            </TiltCard>
          )
        })}
      </div>
      <section className="popular-guides">
        <div className="section-title-row"><div><span className="overline">С чего начать</span><h2>Популярные инструкции</h2></div></div>
        <div className="guide-card-grid">{DOM_GUIDES.filter((guide) => ['room-kitchen-surfaces','room-bathroom-surfaces','surfaces-floor-transition-plan','paint-sheen-room-guide','floor-lvt-guide','wall-decorative-plaster-guide'].includes(guide.id)).map((guide, i) => <GuideCard key={guide.id} guide={guide} image={CATEGORY_ART[i % CATEGORY_ART.length]} />)}</div>
      </section>
    </main>
  )
}

function CategoryPage({ id }) {
  const category = DOM_CATEGORY_BY_ID[id]
  if (!category) return <NotFound />
  const guides = DOM_GUIDES.filter((guide) => guide.category === id)
  return (
    <main className="page page--paper">
      <div className="category-banner" data-reveal>
        <img src={CATEGORY_ART[Math.max(0, DOM_CATEGORIES.findIndex((c) => c.id === id)) % CATEGORY_ART.length]} alt="" />
        <div />
        <Link href="#/catalog" className="back-chip">← Все разделы</Link>
        <section><span className="overline">Раздел</span><h1>{category.title}</h1><p>{category.description}</p><strong>{guides.length ? `${guides.length} практических инструкций` : 'Контент готовится'}</strong></section>
      </div>
      {guides.length ? <div className="guide-card-grid category-guides">{guides.map((guide, i) => <GuideCard key={guide.id} guide={guide} image={CATEGORY_ART[(i + 2) % CATEGORY_ART.length]} />)}</div> : <Empty title="Раздел уже в структуре" text="Инструкции появятся здесь без изменения логики интерфейса." />}
    </main>
  )
}

function GuideCard({ guide, image }) {
  const { saved, toggleSaved } = useSaved()
  const active = saved.has(guide.id)
  return (
    <article className="guide-list-card" data-reveal>
      <Link href={`#/guide/${guide.id}`} className="guide-list-card__image"><img src={image || IMAGES.drywall} alt="" loading="lazy" /><span>{guide.difficulty}</span></Link>
      <div className="guide-list-card__body">
        <div className="guide-list-card__meta"><span>{DOM_CATEGORY_BY_ID[guide.category]?.title || guide.category}</span><span><Icon name="clock" size={13} /> {guide.duration}</span></div>
        <Link href={`#/guide/${guide.id}`}><h3>{guide.title}</h3></Link>
        <p>{guide.summary}</p>
        <button className={`save-round ${active ? 'active' : ''}`} onClick={() => toggleSaved(guide.id)} aria-label={active ? 'Убрать из сохранённых' : 'Сохранить'}><Icon name={active ? 'heart' : 'bookmark'} size={18} /></button>
      </div>
    </article>
  )
}

function GuidePage({ id }) {
  const guide = DOM_GUIDE_BY_ID[id]
  const { saved, toggleSaved } = useSaved()
  const [activeStep, setActiveStep] = useState(0)
  if (!guide) return <NotFound />
  const category = DOM_CATEGORY_BY_ID[guide.category]
  const heroImage = CATEGORY_IMAGE_BY_ID[guide.category] || (id.includes('socket') ? IMAGES.electrical : id.includes('door') ? IMAGES.wood : IMAGES.drywall)
  const practical = getGuidePracticalDetail(guide)
  const shopping = getLemanaShopping(guide)
  return (
    <main className="page guide-page">
      <div className="guide-breadcrumb"><Link href="#/home">Главная</Link><span>›</span><Link href={`#/category/${guide.category}`}>{category?.title || 'Раздел'}</Link><span>›</span><b>{guide.title}</b></div>
      <header className="guide-page__head" data-reveal>
        <div><span className="overline">{category?.title} · {guide.task}</span><h1>{guide.title}</h1><p>{guide.summary}</p><div className="guide-tags"><span>{guide.difficulty}</span><span><Icon name="clock" size={14} /> {guide.duration}</span><span>{guide.material}</span></div></div>
        <button className={`save-pill ${saved.has(id) ? 'active' : ''}`} onClick={() => toggleSaved(id)}><Icon name="bookmark" size={17} />{saved.has(id) ? 'Сохранено' : 'Сохранить'}</button>
      </header>
      <div className="guide-layout">
        <aside className="guide-toc" data-reveal>
          <strong>Содержание</strong>
          {guide.steps.map((step, i) => <button key={step.title} className={activeStep === i ? 'active' : ''} onClick={() => { setActiveStep(i); document.getElementById(`step-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}><span>{i + 1}</span>{step.title}</button>)}
          <button onClick={() => document.getElementById('practical')?.scrollIntoView({ behavior: 'smooth' })}><span>✓</span>Практический разбор</button>
          <button onClick={() => document.getElementById('shopping')?.scrollIntoView({ behavior: 'smooth' })}><span>₽</span>Что купить</button>
          <button onClick={() => document.getElementById('mistakes')?.scrollIntoView({ behavior: 'smooth' })}><span>!</span>Частые ошибки</button>
          {guide.sources?.length ? <button onClick={() => document.getElementById('sources')?.scrollIntoView({ behavior: 'smooth' })}><span>↗</span>Источники</button> : null}
        </aside>
        <article className="guide-article">
          <div className="article-visual" data-reveal style={{ backgroundImage: `url(${heroImage})` }}><button aria-label="Запустить видео"><Icon name="play" /></button><div className="hand-note">Профиль<br />и крепления →</div></div>
          <div className="guide-side-cards" data-reveal>
            <InfoList title="Что понадобится" items={[...guide.tools.slice(0, 4), ...guide.materials.slice(0, 2)]} icon="hammer" />
            <div className="master-tip"><div className="master-avatar">М</div><div><strong>Совет мастера</strong><p>{guide.before[0]}</p></div></div>
          </div>
          <section className="material-links" data-reveal>
            <div><span className="overline">Материалы из этой инструкции</span><p>Быстрый переход в каталог. Размер и совместимость всё равно сверяйте с конкретным узлом.</p></div>
            <div className="material-links__list">
              {guide.materials.map((material) => <a href={getMaterialSearchUrl(material)} target="_blank" rel="noreferrer" key={material}>{material}<Icon name="arrow" size={13} /></a>)}
            </div>
          </section>
          <section className="before-box" data-reveal><span><Icon name="warning" /></span><div><strong>Перед началом</strong>{guide.before.map((item) => <p key={item}>{item}</p>)}</div></section>
          <section id="practical" className="practical-detail" data-reveal>
            <div className="practical-detail__head">
              <span className="overline">Практический разбор</span>
              <h2>Что важно решить до работы и как принять результат</h2>
              <p>Здесь собраны детали, которые обычно теряются в коротких инструкциях: выбор системы, контроль скрытых этапов и признаки, когда нельзя просто продолжать отделку.</p>
            </div>
            <div className="practical-detail__grid">
              <div className="practical-card"><span>01</span><strong>Как выбирать материалы и узел</strong><ul>{practical.selection.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div className="practical-card"><span>02</span><strong>Как проверить качество</strong><ul>{practical.quality.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
            <div className="practical-stop"><Icon name="warning" size={18} /><div><strong>Когда не стоит продолжать</strong><p>{practical.stop}</p></div></div>
          </section>
          <section className="steps-rich">
            {guide.steps.map((step, i) => (
              <article id={`step-${i}`} className="rich-step" data-reveal key={step.title}>
                <div className="rich-step__number">{i + 1}</div><div><h2>{step.title}</h2><p>{step.text}</p>{i === 0 && <div className="mini-diagram"><span /><span /><span /><b>90°</b></div>}</div>
              </article>
            ))}
          </section>
          <section id="shopping" className="shopping-section" data-reveal>
            <div className="shopping-section__head">
              <div><span className="overline">Что купить</span><h2>Подходящие товары в Лемана ПРО</h2></div>
              <p>Это не реклама и не жёсткая привязка к одному бренду. Карточки показывают нужный тип, размер и назначение товара; цена и наличие зависят от выбранного магазина.</p>
            </div>
            <div className="shopping-grid">
              {shopping.map((item) => (
                <a className="shopping-card" href={item.url} target="_blank" rel="noreferrer" key={item.id + item.title}>
                  <div className="shopping-card__meta"><span>{item.kind}</span>{item.sku ? <b>ЛМ {item.sku}</b> : <b>Каталог</b>}</div>
                  <strong>{item.title}</strong>
                  <p>{item.spec}</p>
                  <span className="shopping-card__cta">Открыть в Лемана ПРО <Icon name="arrow" size={14} /></span>
                </a>
              ))}
            </div>
            <div className="shopping-note"><Icon name="check" size={17} /><p><b>Перед заказом:</b> сверь основание, толщину слоёв, размер крепежа и системную совместимость. Если товар исчезнет из продажи, ссылка поиска приведёт к актуальным аналогам.</p></div>
          </section>
          <section id="mistakes" className="mistakes-grid" data-reveal>
            <div><span className="overline danger">Частые ошибки</span><ul>{guide.mistakes.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><span className="overline success">Если уже сделал</span><p>{guide.rescue}</p></div>
          </section>
          <div className="verification" data-reveal><Icon name="check" /><div><strong>{guide.sources?.length ? 'Материал собран по техническим источникам' : 'Статус материала: рабочий черновик'}</strong><p>{guide.verification}</p></div></div>
          {guide.sources?.length ? (
            <section id="sources" className="guide-sources" data-reveal>
              <div className="guide-sources__head">
                <div><span className="overline">Проверка и первоисточники</span><h2>Откуда взята логика</h2></div>
                <p>Это не список «для солидности»: источники привязаны к узлам и принципам. Точные размеры, нагрузки и допуски всегда сверяйте с конкретной системой, проектом и действующими требованиями для объекта.</p>
              </div>
              <div className="guide-sources__grid">
                {guide.sources.map((source) => (
                  <a className="source-card" href={source.url} target="_blank" rel="noreferrer" key={source.id}>
                    <div className="source-card__meta"><span>{source.scope}</span><span>{source.type}</span></div>
                    <strong>{source.title}</strong>
                    <small>{source.publisher}</small>
                    <p>{source.note}</p>
                    <b>Открыть источник <Icon name="arrow" size={14} /></b>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </article>
      </div>
    </main>
  )
}

function InfoList({ title, items, icon }) {
  return <div className="info-list"><div className="info-list__title"><span><Icon name={icon} /></span><strong>{title}</strong></div>{items.map((item) => <div className="info-list__row" key={item}><Icon name="check" size={14} />{item}</div>)}</div>
}

function normalize(value) {
  return String(value || '').toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/[^\p{L}\p{N}\s-]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

const SEARCH_INDEX = DOM_GUIDES.map((guide) => { const shopping = getLemanaShopping(guide); return { guide, text: normalize([guide.title, guide.summary, guide.task, guide.material, ...guide.tags, ...guide.tools, ...guide.materials, ...shopping.map((item) => item.title + ' ' + item.kind)].join(' ')) } })

function getSearchResults(query) {
  const needle = normalize(query)
  if (!needle) return DOM_GUIDES
  const words = needle.split(' ')
  return SEARCH_INDEX.map(({ guide, text }) => {
    const title = normalize(guide.title)
    let score = title.includes(needle) ? 12 : 0
    words.forEach((word) => { if (text.includes(word)) score += title.includes(word) ? 4 : 1 })
    return { guide, score }
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.guide)
}

function SearchPage({ query, setQuery }) {
  const results = useMemo(() => getSearchResults(query), [query])
  const suggestions = ['скрытые работы', 'гидроизоляция', 'стяжка', 'вентиляция', 'УЗО', 'звукоизоляция', 'подрозетник', 'тёплый пол']
  return (
    <main className="page page--paper search-page">
      <PageIntro eyebrow="Умный локальный поиск" title="Что нужно сделать?" text="Можно писать бытовым языком — поиск смотрит название задачи, материал, инструмент и типичные формулировки." />
      <div className="search-page__field"><SearchField query={query} setQuery={setQuery} autoNavigate={false} /><button className="voice-button" aria-label="Голосовой поиск"><Icon name="mic" /></button></div>
      <div className="suggestions">{suggestions.map((s) => <button onClick={() => setQuery(s)} key={s}>{s}</button>)}</div>
      <div className="search-result-head"><strong>{query ? `Результаты для «${query}»` : 'Все инструкции'}</strong><span>{results.length}</span></div>
      {results.length ? <div className="guide-card-grid">{results.map((guide, i) => <GuideCard key={guide.id} guide={guide} image={CATEGORY_ART[i % CATEGORY_ART.length]} />)}</div> : <Empty title="Ничего не найдено" text="Попробуй убрать лишние слова или выбрать один из быстрых запросов." />}
    </main>
  )
}

function CalculatorPage() {
  const [values, setValues] = useState({ width: 4.5, height: 2.7, spacing: 0.6, layers: 1 })
  const [result, setResult] = useState(null)
  const calculate = (event) => {
    event?.preventDefault()
    const wall = Number(values.width) * Number(values.height)
    const sheets = Math.ceil((wall * 2 * Number(values.layers) * 1.1) / (1.2 * 2.5))
    const studs = Math.ceil(Number(values.width) / Number(values.spacing)) + 1
    setResult({ sheets, studs, track: (Number(values.width) * 2 * 1.1).toFixed(1), studLength: (studs * Number(values.height) * 1.05).toFixed(1), insulation: (wall * 1.05).toFixed(1) })
  }
  const field = (key, label, opts = {}) => <label><span>{label}</span>{opts.options ? <select value={values[key]} onChange={(e) => setValues({ ...values, [key]: Number(e.target.value) })}>{opts.options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select> : <div className="unit-input"><input type="number" min={opts.min || 0} step={opts.step || .1} value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} /><b>{opts.unit}</b></div>}</label>
  return (
    <main className="page page--paper calculator-page">
      <PageIntro eyebrow="Калькуляторы" title="Расчёт гипсокартонной перегородки" text="Быстрый ориентир для закупки материалов. Проёмы, усиления и раскладку листов нужно уточнять отдельно." />
      <div className="calculator-layout">
        <aside className="calculator-nav" data-reveal>{['Гипсокартон', 'Штукатурка', 'Краска', 'Плитка', 'Ламинат', 'Стяжка', 'Тёплый пол', 'Кирпич и блоки'].map((item, i) => <button className={i === 0 ? 'active' : ''} key={item}><Icon name={i === 0 ? 'layers' : 'calc'} size={16} />{item}</button>)}</aside>
        <section className="calculator-main" data-reveal>
          <form onSubmit={calculate}>
            <div className="calculator-tabs"><span className="active">Размеры помещения</span><span>Тип конструкции</span></div>
            <div className="field-grid-premium">{field('width', 'Длина перегородки', { unit: 'м', min: .5 })}{field('height', 'Высота', { unit: 'м', min: 1 })}{field('spacing', 'Шаг стоек', { options: [[.6,'600 мм'], [.4,'400 мм']] })}{field('layers', 'Слоёв ГКЛ', { options: [[1,'1 слой'], [2,'2 слоя']] })}</div>
            <button className="calc-submit" type="submit">Рассчитать <Icon name="arrow" size={16} /></button>
          </form>
          <WallSchematic width={values.width} height={values.height} />
          <div className={`calculation-results ${result ? 'show' : ''}`}>
            <h3>Результат расчёта</h3>
            {result ? <div className="result-cards">
              <ResultCard value={result.sheets} label="листов ГКЛ" />
              <ResultCard value={`${result.track} м`} label="профиля UW" />
              <ResultCard value={result.studs} label="стоек CW" />
              <ResultCard value={`${result.studLength} м`} label="CW суммарно" />
              <ResultCard value={`${result.insulation} м²`} label="минваты" />
            </div> : <p>Заполните параметры и нажмите «Рассчитать».</p>}
          </div>
        </section>
      </div>
    </main>
  )
}

function ResultCard({ value, label }) { return <div className="result-card"><span><Icon name="layers" /></span><strong>{value}</strong><small>{label}</small></div> }

function WallSchematic({ width, height }) {
  return <div className="wall-schematic"><div className="stud-wall">{[0,1,2,3,4,5,6].map((n) => <i key={n} />)}<span className="sheet left" /><span className="sheet right" /></div><div className="measure measure--w"><b>{width || 0} м</b></div><div className="measure measure--h"><b>{height || 0} м</b></div><div className="schematic-mode"><button className="active">3D</button><button>Схема</button></div></div>
}

function ProjectPage() {
  const [progress, setProgress] = useState(() => Number(localStorage.getItem(PROJECT_KEY) || 68))
  useEffect(() => localStorage.setItem(PROJECT_KEY, String(progress)), [progress])
  return (
    <main className="project-page-full">
      <div className="project-appbar"><div><span className="overline">Мой проект</span><h1>Ремонт квартиры 60 м²</h1><Link href="#/planner" className="planner-launch-banner">Открыть 3D планировщик</Link></div><div className="project-stage-control"><span>Чистовая отделка</span><input type="range" min="0" max="100" value={progress} onChange={(e) => setProgress(Number(e.target.value))} /><b>{progress}%</b></div></div>
      <div className="project-workspace" data-reveal>
        <aside className="workspace-nav">
          <strong>Мой проект</strong>
          {['Обзор', 'Этапы', 'План помещений', 'Список покупок', 'Калькуляторы', 'Документы', 'Заметки', 'Команда', 'Бюджет', 'Галерея'].map((item, i) => <button className={i === 1 ? 'active' : ''} key={item}><Icon name={i === 2 ? 'project' : i === 3 ? 'check' : i === 4 ? 'calc' : 'grid'} size={17} />{item}</button>)}
        </aside>
        <section className="workspace-main"><div className="workspace-tabs"><button>План</button><button>Задачи</button><button>Покупки</button><button>Бюджет</button><button>Файлы</button><button>Заметки</button></div><FloorPlan /><div className="plan-controls"><button><Icon name="ruler" /> Измерения</button><button>−</button><button>+</button></div></section>
        <aside className="workspace-right"><div className="rooms-tabs"><button>Этажи</button><button>2D план</button><button className="active">3D вид</button></div><FloorPlan compact /><strong>Список помещений <small>(6)</small></strong>{[['Гостиная','18.2 м²'],['Кухня','10.4 м²'],['Спальня','12.5 м²'],['Ванная','4.8 м²'],['Прихожая','6.1 м²'],['Балкон','3.6 м²']].map(([r,a],i)=><button className="workspace-room" key={r}><i style={{ backgroundImage:`url(${[IMAGES.apartment,IMAGES.kitchen,IMAGES.apartment,IMAGES.bathroom,IMAGES.room,IMAGES.apartment][i]})`}}/><span><b>{r}</b><small>{a}</small></span><Icon name="chevron" size={14}/></button>)}</aside>
      </div>
    </main>
  )
}

const SavedContext = createContext(null)
function SavedProvider({ children }) {
  const [saved, setSaved] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch { return new Set() }
  })
  const toggleSaved = (id) => setSaved((previous) => {
    const next = new Set(previous)
    next.has(id) ? next.delete(id) : next.add(id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
    return next
  })
  return <SavedContext.Provider value={{ saved, toggleSaved }}>{children}</SavedContext.Provider>
}
function useSaved() { return useContext(SavedContext) }

function SavedPage() {
  const { saved } = useSaved()
  const guides = DOM_GUIDES.filter((guide) => saved.has(guide.id))
  return <main className="page page--paper"><PageIntro eyebrow="Ваша коллекция" title="Сохранённое" text="Инструкции, которые нужны прямо сейчас на объекте. Хранятся локально на этом устройстве." />{guides.length ? <div className="guide-card-grid">{guides.map((guide,i)=><GuideCard key={guide.id} guide={guide} image={CATEGORY_ART[i % CATEGORY_ART.length]}/>)}</div> : <Empty title="Здесь пока пусто" text="Нажмите значок сохранения в любой инструкции — она появится здесь." />}</main>
}

function PageIntro({ eyebrow, title, text }) {
  return <header className="page-intro" data-reveal><span className="overline">{eyebrow}</span><h1>{title}</h1><p>{text}</p></header>
}

function Empty({ title, text }) { return <section className="empty-premium"><span><Icon name="spark" size={28} /></span><h2>{title}</h2><p>{text}</p><MagneticButton href="#/catalog" className="button-dark">Перейти в разделы</MagneticButton></section> }
function NotFound() { return <main className="page page--paper"><Empty title="Страница не найдена" text="Эта ссылка больше не ведёт к материалу." /></main> }

function CommandPalette({ open, onClose, query, setQuery }) {
  const { navigate } = useNavigation()
  const inputRef = useRef(null)
  const results = useMemo(() => getSearchResults(query).slice(0, 6), [query])
  useEffect(() => { if (open) requestAnimationFrame(() => inputRef.current?.focus()) }, [open])
  if (!open) return null
  return <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="command-palette" role="dialog" aria-modal="true" aria-label="Быстрый поиск">
      <div className="palette-input"><Icon name="search" /><input ref={inputRef} value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Что вы хотите сделать?" onKeyDown={(e)=> e.key === 'Escape' && onClose()} /><kbd>ESC</kbd></div>
      <div className="palette-results">{results.map((guide) => <button key={guide.id} onClick={() => { navigate(`#/guide/${guide.id}`); onClose() }}><span><Icon name="hammer" /></span><div><strong>{guide.title}</strong><small>{guide.summary}</small></div><Icon name="arrow" size={16} /></button>)}</div>
      <footer><span>↑↓ выбрать</span><span>↵ открыть</span><span>⌘K поиск</span></footer>
    </div>
  </div>
}

function BottomNav() {
  const { route } = useNavigation()
  const items = [
    ['home', 'Главная', '#/home', 'home'],
    ['catalog', 'Разделы', '#/catalog', 'grid'],
    ['search', 'Поиск', '#/search', 'search'],
    ['project', 'Проект', '#/project', 'project'],
    ['saved', 'Сохранено', '#/saved', 'bookmark'],
  ]
  return <nav className="bottom-app-nav" aria-label="Основная навигация">{items.map(([view,label,href,icon]) => <Link key={view} href={href} className={route.view === view || (view === 'project' && route.view === 'planner') || (view === 'catalog' && ['category','guide'].includes(route.view)) ? 'active' : ''}><span><Icon name={icon} size={20} /></span><small>{label}</small></Link>)}</nav>
}

function App() {
  const { route } = useNavigation()
  const [query, setQueryState] = useState(() => localStorage.getItem(SEARCH_KEY) || '')
  const [palette, setPalette] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const setQuery = (value) => { setQueryState(value); localStorage.setItem(SEARCH_KEY, value) }
  useReveal(route.key)

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPalette(true) }
      if (event.key === 'Escape') setPalette(false)
    }
    const onInstall = (event) => { event.preventDefault(); setInstallPrompt(event) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeinstallprompt', onInstall)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeinstallprompt', onInstall) }
  }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {})
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const syncDisplayMode = () => {
      const standalone = media.matches || window.navigator.standalone === true
      document.documentElement.classList.toggle('is-standalone', standalone)
      document.documentElement.dataset.displayMode = standalone ? 'standalone' : 'browser'
    }

    syncDisplayMode()
    media.addEventListener?.('change', syncDisplayMode)
    return () => media.removeEventListener?.('change', syncDisplayMode)
  }, [])

  useEffect(() => {
    const guide = route.view === 'guide' ? DOM_GUIDE_BY_ID[route.id] : null
    const titles = { home: 'Дом — ремонт и строительство', catalog: 'Разделы — Дом', search: 'Поиск — Дом', calculator: 'Калькуляторы — Дом', planner: '3D планировщик квартиры — Дом', saved: 'Сохранённое — Дом', project: 'Мой проект — Дом' }
    document.title = guide ? `${guide.title} — Дом` : (titles[route.view] || 'Дом — ремонт и строительство')
  }, [route])

  const page = route.view === 'home' ? <HomePage query={query} setQuery={setQuery} />
    : route.view === 'catalog' ? <CatalogPage />
    : route.view === 'category' ? <CategoryPage id={route.id} />
    : route.view === 'guide' ? <GuidePage id={route.id} />
    : route.view === 'search' ? <SearchPage query={query} setQuery={setQuery} />
    : route.view === 'calculator' ? <CalculatorPage />
    : route.view === 'planner' ? <PlannerPage />
    : route.view === 'project' ? <ProjectPage />
    : route.view === 'saved' ? <SavedPage /> : <NotFound />

  return <div className={`app app--${route.view}`}>
    <Header query={query} setQuery={setQuery} openPalette={() => setPalette(true)} />
    <div className="page-transition" key={route.key}>{page}</div>
    <BottomNav />
    {installPrompt && <button className="install-fab" onClick={async () => { await installPrompt.prompt(); setInstallPrompt(null) }}><Icon name="home" size={17} /> На экран</button>}
    <CommandPalette open={palette} onClose={() => setPalette(false)} query={query} setQuery={setQuery} />
  </div>
}

createRoot(document.getElementById('root')).render(<NavigationProvider><SavedProvider><App /></SavedProvider></NavigationProvider>)
