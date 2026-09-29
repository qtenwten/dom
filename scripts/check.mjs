import { access, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const required = [
  'index.html',
  '404.html',
  'src/main.jsx',
  'src/styles.css',
  'content.js',
  'manifest.webmanifest',
  'sw.js',
  'icon.svg',
]

for (const file of required) await access(file)
for (const file of ['content.js', 'sw.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
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

console.log('Dom premium React checks passed.')
