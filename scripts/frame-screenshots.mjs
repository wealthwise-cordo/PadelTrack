// Turns raw Simulator screenshots (app-store/raw, 1320×2868) into App Store
// screenshots with a headline and the screen in a phone frame, on alternating
// white and orange backgrounds. Output: app-store/screenshots/ at 1206×2622,
// the size App Store Connect asks for under "iPhone with Dynamic Island".
// Run: node scripts/frame-screenshots.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { execFileSync } from 'child_process'
import { createRequire } from 'module'
const root = new URL('..', import.meta.url).pathname
const require = createRequire(root + 'package.json')
const { ImageResponse } = require('next/og')
const React = require('react')
const h = React.createElement

const ORANGE = '#f97316'
const DARK = '#18181b'
// Raw captures are 1320×2868; the layout below is drawn for that and scaled.
const RAW_W = 1320, RAW_H = 2868
const W = 1206, H = 2622
const k = W / RAW_W
const px = n => Math.round(n * k)

const SHOTS = [
  { file: '14.20.55', name: '01-ranking', title: 'See where you really rank', sub: 'Your circle, ranked by every result' },
  { file: '15.00.18', name: '02-stats', title: 'Watch your rating climb', sub: 'Every ranked match moves your level' },
  { file: '15.00.46', name: '03-match-centre', title: 'Scores everyone agrees on', sub: 'Opponents confirm every result' },
  { file: '15.01.44', name: '04-add-score', title: 'Add the score in seconds', sub: 'Pick the four, type the sets, done' },
  { file: '15.01.52', name: '05-events', title: 'Run the social night', sub: 'Americano, Round Robin and ladders' },
]

const font = f => readFileSync(`/System/Library/Fonts/Supplemental/${f}`)
const fonts = [
  { name: 'Head', data: font('Arial Black.ttf'), weight: 900, style: 'normal' },
  { name: 'Body', data: font('Arial Bold.ttf'), weight: 700, style: 'normal' },
]

mkdirSync(root + 'app-store/screenshots', { recursive: true })
for (const [i, s] of SHOTS.entries()) {
  const orange = i % 2 === 1
  const screen = 'data:image/png;base64,' + readFileSync(root + `app-store/raw/${s.file}.png`).toString('base64')
  const bezel = 30
  const bezelPx = px(bezel)
  const sw = px(1060), sh = Math.round(sw * RAW_H / RAW_W)
  const el = h('div', { style: { width: W, height: H, display: 'flex', flexDirection: 'column', alignItems: 'center', background: orange ? ORANGE : '#ffffff', overflow: 'hidden' } },
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: px(210), paddingLeft: px(90), paddingRight: px(90) } },
      h('div', { style: { fontFamily: 'Head', fontSize: px(112), lineHeight: 1.06, letterSpacing: -3, textAlign: 'center', color: orange ? '#ffffff' : ORANGE } }, s.title),
      h('div', { style: { fontFamily: 'Body', fontSize: px(50), marginTop: px(34), textAlign: 'center', color: orange ? 'rgba(255,255,255,0.88)' : '#52525b' } }, s.sub)),
    h('div', { style: { display: 'flex', marginTop: px(110), padding: bezelPx, background: DARK, borderRadius: px(150),
      boxShadow: orange ? '0 30px 80px rgba(0,0,0,0.25)' : '0 30px 90px rgba(0,0,0,0.18)' } },
      h('img', { src: screen, width: sw, height: sh, style: { borderRadius: px(150) - bezelPx } })))
  const tmp = `/tmp/frame-${s.name}.png`
  writeFileSync(tmp, Buffer.from(await new ImageResponse(el, { width: W, height: H, fonts }).arrayBuffer()))
  // App Store wants flattened RGB with no transparency.
  const out = root + `app-store/screenshots/${s.name}.png`
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '100', tmp, '--out', tmp + '.jpg'])
  execFileSync('sips', ['-s', 'format', 'png', tmp + '.jpg', '--out', out])
  console.log('  ✓', s.name)
}
