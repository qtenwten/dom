import { access, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const required = [
  'index.html',
  '404.html',
  'src/main.jsx',
  'src/styles.css',
  'src/planner.jsx',
  'src/planner.css',
  'src/planner-engine.js',
  'src/planner-advanced.js',
  'src/planner-advanced.jsx',
  'content.js',
  'surface-content.js',
  'guide-enrichment.js',
  'manifest.webmanifest',
  'sw.js',
  'icon.svg',
]

for (const file of required) await access(file)
for (const file of ['content.js', 'surface-content.js', 'guide-enrichment.js', 'sw.js', 'src/planner-engine.js', 'src/planner-advanced.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}


const { DOM_CATEGORIES, DOM_GUIDES, DOM_SOURCES, DOM_ROOMS, DOM_SURFACE_FAMILIES, DOM_JOINT_TYPES, DOM_BASEBOARD_TYPES } = await import('../content.js')
const { getLemanaShopping, getGuidePracticalDetail } = await import('../guide-enrichment.js')
const {
  analyzeSurfaceLayout,
  buildTopologyRooms,
  buildWorkPlan,
  normalizeRoutes,
  packageTakeoff,
  routeLengthCm,
} = await import('../src/planner-advanced.js')
if (DOM_CATEGORIES.length < 14) throw new Error(`Expected at least 14 primary categories, found ${DOM_CATEGORIES.length}.`)
if (DOM_GUIDES.length < 170) throw new Error(`Research corpus unexpectedly small: ${DOM_GUIDES.length} guides.`)
if (Object.keys(DOM_SOURCES).length < 40) throw new Error('Source library unexpectedly small.')
if (DOM_ROOMS.length < 10) throw new Error('Room selector is incomplete.')
if (DOM_SURFACE_FAMILIES.length < 30) throw new Error('Surface taxonomy is incomplete.')
if (DOM_JOINT_TYPES.length < 10) throw new Error('Joint taxonomy is incomplete.')
if (DOM_BASEBOARD_TYPES.length < 10) throw new Error('Baseboard taxonomy is incomplete.')

const categoryIds = new Set(DOM_CATEGORIES.map((category) => category.id))
const guideIds = new Set()
for (const guide of DOM_GUIDES) {
  if (!categoryIds.has(guide.category)) throw new Error(`Guide ${guide.id} points to unknown category ${guide.category}.`)
  if (guideIds.has(guide.id)) throw new Error(`Duplicate guide id: ${guide.id}`)
  guideIds.add(guide.id)
  if (!guide.summary || !Array.isArray(guide.steps) || guide.steps.length < 5) {
    throw new Error(`Guide ${guide.id} is missing a summary or a complete step sequence.`)
  }
  if (!Array.isArray(guide.sources) || guide.sources.length === 0) {
    throw new Error(`Guide ${guide.id} has no research sources.`)
  }
  for (const source of guide.sources) {
    if (!source.url?.startsWith('https://')) throw new Error(`Guide ${guide.id} has an invalid source URL.`)
    if (!source.publisher || !source.type || !source.scope) throw new Error(`Guide ${guide.id} has incomplete source metadata.`)
  }
  const shopping = getLemanaShopping(guide)
  if (shopping.length < 4) throw new Error(`Guide ${guide.id} has too few shopping recommendations: ${shopping.length}.`)
  for (const item of shopping) {
    if (!item.title || !item.spec || !item.url?.startsWith('https://lemanapro.ru')) {
      throw new Error(`Guide ${guide.id} has an invalid Lemana Pro shopping item.`)
    }
  }
  const detail = getGuidePracticalDetail(guide)
  if (!Array.isArray(detail.selection) || !detail.selection.length || !Array.isArray(detail.quality) || !detail.quality.length || !detail.stop) {
    throw new Error(`Guide ${guide.id} is missing practical enrichment.`)
  }
}

for (const category of DOM_CATEGORIES) {
  const count = DOM_GUIDES.filter((guide) => guide.category === category.id).length
  if (count < 5) throw new Error(`Category ${category.id} needs at least 5 guides, found ${count}.`)
}

const squareWalls = [
  { id: 'a', x1: 0, y1: 0, x2: 400, y2: 0, phase: 'new' },
  { id: 'b', x1: 400, y1: 0, x2: 400, y2: 300, phase: 'new' },
  { id: 'c', x1: 400, y1: 300, x2: 0, y2: 300, phase: 'new' },
  { id: 'd', x1: 0, y1: 300, x2: 0, y2: 0, phase: 'new' },
]
const topologySquare = buildTopologyRooms(squareWalls)
if (topologySquare.length !== 1 || Math.abs(topologySquare[0].area - 12) > .001) {
  throw new Error('Planner topology must detect a 12 m² closed room.')
}

const dividedWalls = [
  { id: 'n', x1: 0, y1: 0, x2: 600, y2: 0, phase: 'new' },
  { id: 'e', x1: 600, y1: 0, x2: 600, y2: 400, phase: 'new' },
  { id: 's', x1: 600, y1: 400, x2: 0, y2: 400, phase: 'new' },
  { id: 'w', x1: 0, y1: 400, x2: 0, y2: 0, phase: 'new' },
  { id: 'm', x1: 300, y1: 0, x2: 300, y2: 400, phase: 'new' },
]
const topologyDivided = buildTopologyRooms(dividedWalls)
if (topologyDivided.length !== 2 || Math.abs(topologyDivided.reduce((sum, room) => sum + room.area, 0) - 24) > .001) {
  throw new Error('Planner topology must split a closed contour into two rooms at wall intersections.')
}

const route = normalizeRoutes([{ id: 'r', type: 'drain-50', points: [{ x: 0, y: 0 }, { x: 300, y: 400 }], startHeight: 30, endHeight: 15 }])[0]
if (!route || Math.abs(routeLengthCm(route, false) - 500) > .001) throw new Error('Planner route length calculation is broken.')

const layout = analyzeSurfaceLayout(305, 240, { width: 60, height: 60, joint: .2, packageArea: 1.44, centered: true })
if (!layout.boxes || layout.totalArea <= 0) throw new Error('Planner surface layout calculation is broken.')

const packed = packageTakeoff([{ group: 'Пол', name: 'Ламинат', qty: 8.1, unit: 'м²', reserve: '8%', note: '' }])
if (packed[0]?.packages !== 4) throw new Error('Planner package rounding is broken.')

const workPlan = buildWorkPlan({ rooms: [], freeWalls: [], routes: [], engineering: {} })
if (!workPlan.some((task) => task.id === 'measure') || !workPlan.some((task) => task.id === 'handover')) {
  throw new Error('Planner work sequence must include measurement and final handover.')
}

const plannerSource = await readFile('src/planner.jsx', 'utf8')
for (const token of ['TopologyRoomInspector', 'RouteToolbox', 'UnderlayPanel', 'DocumentsView', 'WorkPlanView', 'buildTopologyRooms', 'phaseView']) {
  if (!plannerSource.includes(token)) throw new Error(`Advanced planner feature missing: ${token}`)
}

const manifest = JSON.parse(await readFile('manifest.webmanifest', 'utf8'))
if (manifest.id !== '/dom/') throw new Error('PWA manifest must keep the Dom project identity.')
if (manifest.start_url !== '/dom/#/home' || manifest.scope !== '/') {
  throw new Error('PWA manifest must launch at /dom and keep qsen.ru navigations inside the Home Screen web app scope.')
}

const html = await readFile('index.html', 'utf8')
for (const ref of ['./manifest.webmanifest', './src/main.jsx', './icon.svg']) {
  if (!html.includes(ref)) throw new Error(`index.html is missing ${ref}`)
}
if (!html.includes('id="root"')) throw new Error('React root is missing.')
if (!html.includes("location.pathname === '/dom'")) throw new Error('Slashless /dom launch normalization is missing.')

const fallback = await readFile('404.html', 'utf8')
if (!fallback.includes('/dom/#/home')) throw new Error('404 fallback must recover the Dom app route.')

const source = await readFile('src/main.jsx', 'utf8')
for (const feature of ['createRoot', 'document.startViewTransition', 'IntersectionObserver', 'CommandPalette', 'BottomNav', 'PlannerPage']) {
  if (!source.includes(feature)) throw new Error(`Premium React feature missing: ${feature}`)
}

for (const designToken of [
  '@fontsource-variable/commissioner',
  '@fontsource-variable/unbounded',
  'iconoir/css/iconoir.css',
  'ICON_NAMES',
  'logo__roof',
]) {
  if (!source.includes(designToken)) throw new Error(`Design system v2 dependency missing: ${designToken}`)
}
if (source.includes('const iconPaths =')) throw new Error('Legacy generic inline icon set must not return.')

const sw = await readFile('sw.js', 'utf8')
if (!sw.includes('self.registration.scope')) throw new Error('Service worker must derive its base path from registration scope.')
if (!sw.includes('appShellFallback')) throw new Error('Service worker navigation fallback is missing.')

const styles = await readFile('src/styles.css', 'utf8')
for (const contrastToken of ['--contrast-light-ink', '--contrast-light-muted', '--contrast-dark-ink', '.split-showcase .button-dark > span']) {
  if (!styles.includes(contrastToken)) throw new Error(`Contrast guardrail missing: ${contrastToken}`)
}

console.log(`Dom premium React checks passed: ${DOM_CATEGORIES.length} categories, ${DOM_GUIDES.length} guides, ${Object.keys(DOM_SOURCES).length} sources, ${DOM_ROOMS.length} rooms, ${DOM_SURFACE_FAMILIES.length} surface families; every guide has practical enrichment and Lemana Pro shopping coverage.`)
