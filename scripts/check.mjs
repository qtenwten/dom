import { access, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const required = [
  'index.html',
  '404.html',
  'src/main.jsx',
  'src/styles.css',
  'content.js',
  'surface-content.js',
  'manifest.webmanifest',
  'sw.js',
  'icon.svg',
]

for (const file of required) await access(file)
for (const file of ['content.js', 'surface-content.js', 'sw.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}


const { DOM_CATEGORIES, DOM_GUIDES, DOM_SOURCES, DOM_ROOMS, DOM_SURFACE_FAMILIES, DOM_JOINT_TYPES, DOM_BASEBOARD_TYPES } = await import('../content.js')
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
}

for (const category of DOM_CATEGORIES) {
  const count = DOM_GUIDES.filter((guide) => guide.category === category.id).length
  if (count < 5) throw new Error(`Category ${category.id} needs at least 5 guides, found ${count}.`)
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
for (const feature of ['createRoot', 'document.startViewTransition', 'IntersectionObserver', 'CommandPalette', 'BottomNav']) {
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

console.log(`Dom premium React checks passed: ${DOM_CATEGORIES.length} categories, ${DOM_GUIDES.length} guides, ${Object.keys(DOM_SOURCES).length} sources, ${DOM_ROOMS.length} rooms, ${DOM_SURFACE_FAMILIES.length} surface families.`)
