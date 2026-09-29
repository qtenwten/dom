import { cp, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

await rm('dist', { recursive: true, force: true })

const vite = process.platform === 'win32' ? 'node_modules/.bin/vite.cmd' : 'node_modules/.bin/vite'
const result = spawnSync(vite, ['build', '--base=./'], { stdio: 'inherit' })
if (result.status !== 0) process.exit(result.status ?? 1)

for (const file of ['manifest.webmanifest', 'sw.js', 'icon.svg', '404.html']) {
  await cp(file, `dist/${file}`)
}

await writeFile('dist/.nojekyll', '')
await writeFile('dist/source-version.txt', `${process.env.GITHUB_SHA || 'local'}\n`)
console.log('Built premium React app into dist/.')
