import { cp, mkdir, rm, writeFile } from 'node:fs/promises'

const files = [
  'index.html',
  'app.js',
  'content.js',
  'styles.css',
  'manifest.webmanifest',
  'sw.js',
  'icon.svg',
]

await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })

for (const file of files) {
  await cp(file, `dist/${file}`)
}

await writeFile('dist/.nojekyll', '')
await writeFile('dist/source-version.txt', `${process.env.GITHUB_SHA || 'local'}\n`)

console.log(`Built ${files.length} runtime files into dist/.`)
