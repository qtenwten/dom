import { readFile, access } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const required = [
  'index.html',
  'app.js',
  'content.js',
  'styles.css',
  'manifest.webmanifest',
  'sw.js',
  'icon.svg',
]

for (const file of required) {
  await access(file)
}

for (const file of ['app.js', 'content.js', 'sw.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const manifest = JSON.parse(await readFile('manifest.webmanifest', 'utf8'))
if (manifest.start_url !== './' || manifest.scope !== './') {
  throw new Error('PWA manifest must keep relative start_url and scope.')
}

const html = await readFile('index.html', 'utf8')
for (const ref of ['./manifest.webmanifest', './styles.css', './app.js', './icon.svg']) {
  if (!html.includes(ref)) throw new Error(`index.html is missing ${ref}`)
}

const sw = await readFile('sw.js', 'utf8')
if (!sw.includes('self.registration.scope')) {
  throw new Error('Service worker must derive its base path from registration scope.')
}

console.log('Dom checks passed.')
