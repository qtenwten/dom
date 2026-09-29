import React, { useEffect, useMemo, useRef, useState } from 'react'
import './planner.css'

const STORAGE_KEY = 'qsen-dom:planner-v1'
const SIDES = ['north', 'east', 'south', 'west']
const SIDE_NAMES = { north: 'Северная', east: 'Восточная', south: 'Южная', west: 'Западная' }
const MATERIALS = {
  brick: { label: 'Кирпич', density: 394 },
  block: { label: 'Газоблок', density: 102 },
  drywall: { label: 'ГКЛ на каркасе', density: 0 },
  concrete: { label: 'Бетон / монолит', density: 0 },
  existing: { label: 'Существующая стена', density: 0 },
}
const FINISHES = {
  'plaster-paint': 'Штукатурка + краска',
  tile: 'Плитка',
  wallpaper: 'Обои',
  panels: 'Панели',
  none: 'Без отделки',
}
const FLOORS = {
  laminate: 'Ламинат',
  tile: 'Плитка',
  vinyl: 'Кварц-винил',
  parquet: 'Паркет / инженерная доска',
  screed: 'Только стяжка',
}
const CEILINGS = {
  paint: 'Шпаклёвка + краска',
  stretch: 'Натяжной потолок',
  drywall: 'ГКЛ потолок',
  none: 'Без отделки',
}
const ROOM_TYPES = ['Гостиная', 'Кухня', 'Спальня', 'Ванная', 'Туалет', 'Прихожая', 'Кабинет', 'Гардеробная', 'Детская', 'Балкон', 'Другое']

const uid = (prefix = 'id') => prefix + '-' + Math.random().toString(36).slice(2, 9)
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0))
const snap = (value, grid) => Math.round(value / grid) * grid
const round = (value, digits = 1) => Number(value.toFixed(digits))
const roomWallLength = (room, side) => side === 'north' || side === 'south' ? room.width : room.depth
const openingArea = (opening) => (opening.width * opening.height) / 10000
const lemanaSearch = (query) => 'https://lemanapro.ru/search/?q=' + encodeURIComponent(query)

function makeWall(overrides = {}) {
  return {
    material: 'existing',
    thickness: 120,
    finish: 'plaster-paint',
    openings: [],
    ...overrides,
  }
}

function makeRoom(index = 0, overrides = {}) {
  const room = {
    id: uid('room'),
    name: ROOM_TYPES[index % ROOM_TYPES.length],
    x: 80 + (index % 3) * 370,
    y: 80 + Math.floor(index / 3) * 310,
    width: 340,
    depth: 260,
    height: 270,
    floorFinish: 'laminate',
    ceilingFinish: 'paint',
    walls: {
      north: makeWall(),
      east: makeWall(),
      south: makeWall(),
      west: makeWall(),
    },
    ...overrides,
  }
  return room
}

function makeFreeWall(index = 0) {
  return {
    id: uid('wall'),
    name: 'Свободная стена ' + (index + 1),
    x1: 160,
    y1: 620 + index * 30,
    x2: 460,
    y2: 620 + index * 30,
    height: 270,
    thickness: 100,
    material: 'drywall',
    finish: 'plaster-paint',
    openings: [],
  }
}

function sampleProject() {
  const living = makeRoom(0, {
    id: 'room-living',
    name: 'Гостиная',
    x: 90, y: 80, width: 420, depth: 330, height: 270,
  })
  living.walls.north.openings = [{ id: 'window-1', type: 'window', width: 160, height: 145, offset: 115, sill: 80 }]
  living.walls.east.openings = [{ id: 'door-1', type: 'door', width: 90, height: 205, offset: 115, sill: 0 }]

  const kitchen = makeRoom(1, {
    id: 'room-kitchen',
    name: 'Кухня',
    x: 510, y: 80, width: 310, depth: 330, height: 270,
    floorFinish: 'tile',
  })
  kitchen.walls.north.openings = [{ id: 'window-2', type: 'window', width: 140, height: 145, offset: 85, sill: 80 }]

  const bedroom = makeRoom(2, {
    id: 'room-bedroom',
    name: 'Спальня',
    x: 90, y: 410, width: 390, depth: 300, height: 270,
  })
  bedroom.walls.south.openings = [{ id: 'window-3', type: 'window', width: 150, height: 145, offset: 120, sill: 80 }]

  const bath = makeRoom(3, {
    id: 'room-bath',
    name: 'Ванная',
    x: 480, y: 410, width: 220, depth: 220, height: 270,
    floorFinish: 'tile',
    ceilingFinish: 'stretch',
  })
  SIDES.forEach((side) => { bath.walls[side].finish = 'tile' })
  bath.walls.west.openings = [{ id: 'door-2', type: 'door', width: 70, height: 200, offset: 75, sill: 0 }]

  return {
    version: 1,
    name: 'Моя квартира',
    grid: 20,
    rooms: [living, kitchen, bedroom, bath],
    freeWalls: [],
    prices: {},
  }
}

function normalizeProject(input) {
  if (!input || !Array.isArray(input.rooms)) return sampleProject()
  return {
    version: 1,
    name: String(input.name || 'Моя квартира').slice(0, 80),
    grid: [10, 20, 50].includes(Number(input.grid)) ? Number(input.grid) : 20,
    rooms: input.rooms.slice(0, 80).map((raw, index) => {
      const room = makeRoom(index, {
        ...raw,
        id: raw.id || uid('room'),
        name: String(raw.name || 'Помещение').slice(0, 60),
        x: clamp(raw.x, 0, 5000),
        y: clamp(raw.y, 0, 5000),
        width: clamp(raw.width, 50, 5000),
        depth: clamp(raw.depth, 50, 5000),
        height: clamp(raw.height, 180, 1000),
      })
      room.walls = {}
      SIDES.forEach((side) => {
        const src = raw.walls && raw.walls[side] ? raw.walls[side] : {}
        room.walls[side] = makeWall({
          ...src,
          thickness: clamp(src.thickness || 120, 40, 1000),
          openings: Array.isArray(src.openings) ? src.openings.slice(0, 30).map((o) => ({
            id: o.id || uid('opening'),
            type: o.type === 'window' ? 'window' : 'door',
            width: clamp(o.width, 20, 600),
            height: clamp(o.height, 20, 600),
            offset: clamp(o.offset, 0, 5000),
            sill: clamp(o.sill, 0, 500),
          })) : [],
        })
      })
      return room
    }),
    freeWalls: Array.isArray(input.freeWalls) ? input.freeWalls.slice(0, 120).map((raw, index) => ({
      ...makeFreeWall(index),
      ...raw,
      id: raw.id || uid('wall'),
      name: String(raw.name || 'Свободная стена').slice(0, 60),
      x1: clamp(raw.x1, 0, 5000),
      y1: clamp(raw.y1, 0, 5000),
      x2: clamp(raw.x2, 0, 5000),
      y2: clamp(raw.y2, 0, 5000),
      height: clamp(raw.height, 180, 1000),
      thickness: clamp(raw.thickness, 40, 1000),
      openings: Array.isArray(raw.openings) ? raw.openings.slice(0, 30) : [],
    })) : [],
    prices: input.prices && typeof input.prices === 'object' ? input.prices : {},
  }
}

function getInitialProject() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? normalizeProject(JSON.parse(saved)) : sampleProject()
  } catch {
    return sampleProject()
  }
}

function wallLengthFree(wall) {
  return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
}

function projectMetrics(project) {
  const roomMetrics = project.rooms.map((room) => {
    const floor = room.width * room.depth / 10000
    let wallGross = 0
    let wallNet = 0
    let openings = 0
    let baseboard = 2 * (room.width + room.depth) / 100
    SIDES.forEach((side) => {
      const wall = room.walls[side]
      const len = roomWallLength(room, side)
      const gross = len * room.height / 10000
      const opening = wall.openings.reduce((sum, item) => sum + openingArea(item), 0)
      const doorWidth = wall.openings.filter((item) => item.type === 'door').reduce((sum, item) => sum + item.width / 100, 0)
      wallGross += gross
      wallNet += Math.max(0, gross - opening)
      openings += wall.openings.length
      baseboard -= doorWidth
    })
    return { id: room.id, floor, wallGross, wallNet, openings, baseboard: Math.max(0, baseboard) }
  })

  let freeWallArea = 0
  let freeWallLength = 0
  let freeOpenings = 0
  project.freeWalls.forEach((wall) => {
    const lengthM = wallLengthFree(wall) / 100
    const open = wall.openings.reduce((sum, item) => sum + openingArea(item), 0)
    freeWallLength += lengthM
    freeWallArea += Math.max(0, lengthM * wall.height / 100 - open)
    freeOpenings += wall.openings.length
  })

  const floorArea = roomMetrics.reduce((s, item) => s + item.floor, 0)
  const wallArea = roomMetrics.reduce((s, item) => s + item.wallNet, 0) + freeWallArea
  const baseboard = roomMetrics.reduce((s, item) => s + item.baseboard, 0)
  return {
    floorArea,
    ceilingArea: floorArea,
    wallArea,
    baseboard,
    roomCount: project.rooms.length,
    openingCount: roomMetrics.reduce((s, item) => s + item.openings, 0) + freeOpenings,
    freeWallLength,
    roomMetrics,
  }
}

function buildTakeoff(project) {
  const rows = []
  const add = (group, name, qty, unit, reserve, note) => {
    if (qty <= 0) return
    rows.push({ group, name, qty: round(qty, unit === 'шт' ? 0 : 1), unit, reserve, note })
  }

  const floorGroups = {}
  const ceilingGroups = {}
  const wallFinishGroups = {}
  const wallMaterialAreas = {}
  const structuralSegments = new Set()
  const segmentKey = (room, side, wall) => {
    const endpoints = side === 'north' ? [room.x, room.y, room.x + room.width, room.y]
      : side === 'south' ? [room.x, room.y + room.depth, room.x + room.width, room.y + room.depth]
      : side === 'west' ? [room.x, room.y, room.x, room.y + room.depth]
      : [room.x + room.width, room.y, room.x + room.width, room.y + room.depth]
    const a = endpoints[0] + ',' + endpoints[1]
    const b = endpoints[2] + ',' + endpoints[3]
    return [a < b ? a : b, a < b ? b : a, wall.material, wall.thickness].join('|')
  }

  project.rooms.forEach((room) => {
    const floorArea = room.width * room.depth / 10000
    floorGroups[room.floorFinish] = (floorGroups[room.floorFinish] || 0) + floorArea
    ceilingGroups[room.ceilingFinish] = (ceilingGroups[room.ceilingFinish] || 0) + floorArea
    SIDES.forEach((side) => {
      const wall = room.walls[side]
      const gross = roomWallLength(room, side) * room.height / 10000
      const openings = wall.openings.reduce((sum, opening) => sum + openingArea(opening), 0)
      const net = Math.max(0, gross - openings)
      wallFinishGroups[wall.finish] = (wallFinishGroups[wall.finish] || 0) + net
      const key = wall.material + ':' + wall.thickness
      const physicalSegment = segmentKey(room, side, wall)
      if (!structuralSegments.has(physicalSegment)) {
        structuralSegments.add(physicalSegment)
        wallMaterialAreas[key] = (wallMaterialAreas[key] || 0) + net
      }
    })
  })
  project.freeWalls.forEach((wall) => {
    const net = Math.max(0, wallLengthFree(wall) / 100 * wall.height / 100 - wall.openings.reduce((sum, opening) => sum + openingArea(opening), 0))
    wallFinishGroups[wall.finish] = (wallFinishGroups[wall.finish] || 0) + net
    const key = wall.material + ':' + wall.thickness
    wallMaterialAreas[key] = (wallMaterialAreas[key] || 0) + net
  })

  Object.entries(floorGroups).forEach(([key, area]) => {
    add('Пол', FLOORS[key] || key, area * 1.08, 'м²', '8%', 'Запас на подрезку включён')
    if (key === 'laminate' || key === 'parquet') add('Пол', 'Подложка', area * 1.05, 'м²', '5%', 'Ориентир')
  })
  Object.entries(ceilingGroups).forEach(([key, area]) => {
    if (key === 'none') return
    add('Потолок', CEILINGS[key] || key, area * 1.05, 'м²', '5%', 'Площадь с технологическим запасом')
  })
  Object.entries(wallFinishGroups).forEach(([key, area]) => {
    if (key === 'none') return
    add('Стены · отделка', FINISHES[key] || key, area * 1.1, 'м²', '10%', 'Чистая площадь минус проёмы')
  })

  Object.entries(wallMaterialAreas).forEach(([key, area]) => {
    const parts = key.split(':')
    const material = parts[0]
    const thicknessMm = Number(parts[1])
    if (material === 'drywall') {
      add('Стены · конструкция', 'ГКЛ 1200×2500', Math.ceil(area * 2 * 1.1 / 3), 'шт', '10%', 'Обе стороны перегородки; ориентир без раскладки')
    } else if (material === 'brick') {
      const volume = area * thicknessMm / 1000
      add('Стены · конструкция', 'Кирпич одинарный', Math.ceil(volume * 394 * 1.05), 'шт', '5%', 'Ориентир по объёму; кладку уточнить по формату кирпича')
    } else if (material === 'block') {
      const volume = area * thicknessMm / 1000
      add('Стены · конструкция', 'Газоблок', Math.ceil(volume * 102 * 1.05), 'шт', '5%', 'Расчёт для условного блока 625×250 мм; толщину берём из стены')
    }
  })

  const metrics = projectMetrics(project)
  add('Плинтус', 'Плинтус', metrics.baseboard * 1.08, 'м', '8%', 'Дверные проёмы вычтены')
  add('Грунтование', 'Грунтовка стен и потолка', (metrics.wallArea + metrics.ceilingArea) * 0.12, 'л', '≈20%', 'Ориентир 0,12 л/м² на один рабочий цикл')
  return rows
}

function TextInput({ label, value, onChange }) {
  return <label className="planner-field"><span>{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} /></label>
}
function NumberInput({ label, value, onChange, unit, min = 0, max = 9999, step = 1 }) {
  return <label className="planner-field"><span>{label}</span><div className="planner-number"><input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(clamp(e.target.value, min, max))} />{unit && <b>{unit}</b>}</div></label>
}
function SelectInput({ label, value, onChange, options }) {
  return <label className="planner-field"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
}

function WallOpenings({ wall, wallLength, onChange }) {
  const addOpening = (type) => {
    const width = type === 'door' ? 90 : 140
    const height = type === 'door' ? 205 : 145
    const next = { id: uid('opening'), type, width, height, offset: Math.max(0, (wallLength - width) / 2), sill: type === 'door' ? 0 : 80 }
    onChange({ ...wall, openings: [...wall.openings, next] })
  }
  const updateOpening = (id, patch) => onChange({
    ...wall,
    openings: wall.openings.map((item) => item.id === id ? { ...item, ...patch } : item),
  })
  const removeOpening = (id) => onChange({ ...wall, openings: wall.openings.filter((item) => item.id !== id) })

  return <div className="planner-openings">
    <div className="planner-section-head"><strong>Проёмы</strong><span>{wall.openings.length}</span></div>
    {wall.openings.map((opening, index) => <div className="opening-card" key={opening.id}>
      <div className="opening-card__head"><b>{opening.type === 'door' ? 'Дверь' : 'Окно'} {index + 1}</b><button type="button" onClick={() => removeOpening(opening.id)}>Удалить</button></div>
      <div className="planner-fields compact">
        <NumberInput label="Ширина" value={opening.width} unit="см" min={20} max={wallLength} onChange={(v) => updateOpening(opening.id, { width: v })} />
        <NumberInput label="Высота" value={opening.height} unit="см" min={20} max={500} onChange={(v) => updateOpening(opening.id, { height: v })} />
        <NumberInput label="От края" value={opening.offset} unit="см" min={0} max={wallLength} onChange={(v) => updateOpening(opening.id, { offset: v })} />
        {opening.type === 'window' && <NumberInput label="Подоконник" value={opening.sill} unit="см" min={0} max={300} onChange={(v) => updateOpening(opening.id, { sill: v })} />}
      </div>
    </div>)}
    <div className="planner-inline-actions">
      <button type="button" onClick={() => addOpening('door')}>+ дверь</button>
      <button type="button" onClick={() => addOpening('window')}>+ окно</button>
    </div>
  </div>
}

function RoomInspector({ room, side, onRoomChange, onWallChange, onDelete, onDuplicate }) {
  const wall = room.walls[side]
  const length = roomWallLength(room, side)
  return <div className="planner-inspector__content">
    <TextInput label="Название помещения" value={room.name} onChange={(name) => onRoomChange({ name })} />
    <div className="planner-fields">
      <NumberInput label="X" value={room.x} unit="см" onChange={(x) => onRoomChange({ x })} />
      <NumberInput label="Y" value={room.y} unit="см" onChange={(y) => onRoomChange({ y })} />
      <NumberInput label="Ширина" value={room.width} unit="см" min={50} max={5000} onChange={(width) => onRoomChange({ width })} />
      <NumberInput label="Глубина" value={room.depth} unit="см" min={50} max={5000} onChange={(depth) => onRoomChange({ depth })} />
      <NumberInput label="Высота" value={room.height} unit="см" min={180} max={1000} onChange={(height) => onRoomChange({ height })} />
    </div>
    <div className="planner-fields">
      <SelectInput label="Пол" value={room.floorFinish} options={Object.entries(FLOORS)} onChange={(floorFinish) => onRoomChange({ floorFinish })} />
      <SelectInput label="Потолок" value={room.ceilingFinish} options={Object.entries(CEILINGS)} onChange={(ceilingFinish) => onRoomChange({ ceilingFinish })} />
    </div>
    <div className="planner-wall-tabs">{SIDES.map((key) => <button type="button" key={key} className={side === key ? 'active' : ''} onClick={() => onRoomChange({}, key)}>{SIDE_NAMES[key]}</button>)}</div>
    <div className="planner-wall-title"><div><small>Выбрана стена</small><strong>{SIDE_NAMES[side]} · {(length / 100).toFixed(2)} м</strong></div><span>{room.height} см</span></div>
    <div className="planner-fields">
      <NumberInput label="Толщина" value={wall.thickness} unit="мм" min={40} max={1000} onChange={(thickness) => onWallChange({ thickness })} />
      <SelectInput label="Материал" value={wall.material} options={Object.entries(MATERIALS).map(([k, v]) => [k, v.label])} onChange={(material) => onWallChange({ material })} />
      <SelectInput label="Отделка" value={wall.finish} options={Object.entries(FINISHES)} onChange={(finish) => onWallChange({ finish })} />
    </div>
    <WallOpenings wall={wall} wallLength={length} onChange={(nextWall) => onWallChange(nextWall, true)} />
    <div className="planner-danger-actions"><button type="button" onClick={onDuplicate}>Дублировать</button><button type="button" onClick={onDelete}>Удалить помещение</button></div>
  </div>
}

function FreeWallInspector({ wall, onChange, onDelete }) {
  const length = wallLengthFree(wall)
  return <div className="planner-inspector__content">
    <TextInput label="Название стены" value={wall.name} onChange={(name) => onChange({ name })} />
    <div className="planner-fields">
      <NumberInput label="X1" value={wall.x1} unit="см" onChange={(x1) => onChange({ x1 })} />
      <NumberInput label="Y1" value={wall.y1} unit="см" onChange={(y1) => onChange({ y1 })} />
      <NumberInput label="X2" value={wall.x2} unit="см" onChange={(x2) => onChange({ x2 })} />
      <NumberInput label="Y2" value={wall.y2} unit="см" onChange={(y2) => onChange({ y2 })} />
      <NumberInput label="Высота" value={wall.height} unit="см" min={180} max={1000} onChange={(height) => onChange({ height })} />
      <NumberInput label="Толщина" value={wall.thickness} unit="мм" min={40} max={1000} onChange={(thickness) => onChange({ thickness })} />
      <SelectInput label="Материал" value={wall.material} options={Object.entries(MATERIALS).map(([k, v]) => [k, v.label])} onChange={(material) => onChange({ material })} />
      <SelectInput label="Отделка" value={wall.finish} options={Object.entries(FINISHES)} onChange={(finish) => onChange({ finish })} />
    </div>
    <div className="planner-wall-title"><div><small>Фактическая длина</small><strong>{(length / 100).toFixed(2)} м</strong></div><span>{wall.height} см</span></div>
    <WallOpenings wall={wall} wallLength={length} onChange={(nextWall) => onChange(nextWall, true)} />
    <div className="planner-danger-actions"><button type="button" onClick={onDelete}>Удалить стену</button></div>
  </div>
}

function openingLine(room, side, opening) {
  const x = room.x
  const y = room.y
  if (side === 'north') return { x1: x + opening.offset, y1: y, x2: x + opening.offset + opening.width, y2: y }
  if (side === 'south') return { x1: x + opening.offset, y1: y + room.depth, x2: x + opening.offset + opening.width, y2: y + room.depth }
  if (side === 'west') return { x1: x, y1: y + opening.offset, x2: x, y2: y + opening.offset + opening.width }
  return { x1: x + room.width, y1: y + opening.offset, x2: x + room.width, y2: y + opening.offset + opening.width }
}

function FloorPlan2D({ project, selected, setSelected, onDragRoom }) {
  const svgRef = useRef(null)
  const dragRef = useRef(null)

  const startDrag = (event, room) => {
    if (event.button !== 0) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = (event.clientX - rect.left) * 1400 / rect.width
    const py = (event.clientY - rect.top) * 900 / rect.height
    dragRef.current = { id: room.id, dx: px - room.x, dy: py - room.y }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setSelected({ type: 'room', id: room.id, side: selected.id === room.id ? selected.side : 'north' })
  }
  const moveDrag = (event) => {
    const drag = dragRef.current
    const svg = svgRef.current
    if (!drag || !svg) return
    const rect = svg.getBoundingClientRect()
    const px = (event.clientX - rect.left) * 1400 / rect.width
    const py = (event.clientY - rect.top) * 900 / rect.height
    onDragRoom(drag.id, snap(px - drag.dx, project.grid), snap(py - drag.dy, project.grid), false)
  }
  const endDrag = () => {
    if (dragRef.current) onDragRoom(dragRef.current.id, null, null, true)
    dragRef.current = null
  }

  return <svg ref={svgRef} className="planner-svg" viewBox="0 0 1400 900" role="img" aria-label="Редактируемый план квартиры" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
    <defs>
      <pattern id="planner-grid-small" width={project.grid} height={project.grid} patternUnits="userSpaceOnUse"><path d={'M ' + project.grid + ' 0 L 0 0 0 ' + project.grid} fill="none" className="grid-small" /></pattern>
      <pattern id="planner-grid-large" width={project.grid * 5} height={project.grid * 5} patternUnits="userSpaceOnUse"><rect width={project.grid * 5} height={project.grid * 5} fill="url(#planner-grid-small)" /><path d={'M ' + project.grid * 5 + ' 0 L 0 0 0 ' + project.grid * 5} fill="none" className="grid-large" /></pattern>
    </defs>
    <rect width="1400" height="900" fill="url(#planner-grid-large)" />
    {project.rooms.map((room) => {
      const active = selected.type === 'room' && selected.id === room.id
      const walls = {
        north: [room.x, room.y, room.x + room.width, room.y],
        east: [room.x + room.width, room.y, room.x + room.width, room.y + room.depth],
        south: [room.x, room.y + room.depth, room.x + room.width, room.y + room.depth],
        west: [room.x, room.y, room.x, room.y + room.depth],
      }
      return <g key={room.id}>
        <rect className={'plan-room ' + (active ? 'active' : '')} x={room.x} y={room.y} width={room.width} height={room.depth} onPointerDown={(e) => startDrag(e, room)} />
        <text className="plan-room-name" x={room.x + room.width / 2} y={room.y + room.depth / 2 - 8} textAnchor="middle">{room.name}</text>
        <text className="plan-room-area" x={room.x + room.width / 2} y={room.y + room.depth / 2 + 18} textAnchor="middle">{(room.width * room.depth / 10000).toFixed(1)} м²</text>
        <text className="plan-dimension" x={room.x + room.width / 2} y={room.y - 12} textAnchor="middle">{room.width} см</text>
        <text className="plan-dimension" x={room.x - 12} y={room.y + room.depth / 2} textAnchor="middle" transform={'rotate(-90 ' + (room.x - 12) + ' ' + (room.y + room.depth / 2) + ')'}>{room.depth} см</text>
        {SIDES.map((side) => {
          const points = walls[side]
          const wallActive = active && selected.side === side
          return <g key={side}>
            <line className={'plan-wall-hit ' + (wallActive ? 'active' : '')} x1={points[0]} y1={points[1]} x2={points[2]} y2={points[3]} onPointerDown={(e) => { e.stopPropagation(); setSelected({ type: 'room', id: room.id, side }) }} />
            <line className={'plan-wall ' + (wallActive ? 'active' : '')} x1={points[0]} y1={points[1]} x2={points[2]} y2={points[3]} pointerEvents="none" />
            {room.walls[side].openings.map((opening) => {
              const line = openingLine(room, side, opening)
              return <line key={opening.id} className={'plan-opening ' + opening.type} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} pointerEvents="none" />
            })}
          </g>
        })}
      </g>
    })}
    {project.freeWalls.map((wall) => {
      const active = selected.type === 'wall' && selected.id === wall.id
      return <g key={wall.id} onPointerDown={(e) => { e.stopPropagation(); setSelected({ type: 'wall', id: wall.id }) }}>
        <line className={'free-wall-hit ' + (active ? 'active' : '')} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} />
        <line className={'free-wall-line ' + (active ? 'active' : '')} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} pointerEvents="none" />
        <text className="plan-dimension" x={(wall.x1 + wall.x2) / 2} y={(wall.y1 + wall.y2) / 2 - 12} textAnchor="middle">{(wallLengthFree(wall) / 100).toFixed(2)} м</text>
      </g>
    })}
  </svg>
}

function projectPoint(x, y, z, angle, center) {
  const rad = angle * Math.PI / 180
  const dx = x - center.x
  const dy = y - center.y
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad)
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad)
  return {
    x: 700 + (rx - ry) * 0.43,
    y: 500 + (rx + ry) * 0.22 - z * 0.58,
  }
}
const pts = (arr) => arr.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')

function FloorPlan3D({ project, selected, setSelected, angle }) {
  const allX = []
  const allY = []
  project.rooms.forEach((room) => { allX.push(room.x, room.x + room.width); allY.push(room.y, room.y + room.depth) })
  project.freeWalls.forEach((wall) => { allX.push(wall.x1, wall.x2); allY.push(wall.y1, wall.y2) })
  const center = {
    x: allX.length ? (Math.min(...allX) + Math.max(...allX)) / 2 : 500,
    y: allY.length ? (Math.min(...allY) + Math.max(...allY)) / 2 : 400,
  }
  const faces = []
  project.rooms.forEach((room) => {
    const p = (x, y, z) => projectPoint(x, y, z, angle, center)
    const z = room.height
    const floor = [p(room.x, room.y, 0), p(room.x + room.width, room.y, 0), p(room.x + room.width, room.y + room.depth, 0), p(room.x, room.y + room.depth, 0)]
    const top = [p(room.x, room.y, z), p(room.x + room.width, room.y, z), p(room.x + room.width, room.y + room.depth, z), p(room.x, room.y + room.depth, z)]
    faces.push({ key: room.id + '-floor', room, kind: 'floor', poly: floor, depth: room.x + room.y + room.width + room.depth })
    faces.push({ key: room.id + '-north', room, kind: 'wall', side: 'north', poly: [floor[0], floor[1], top[1], top[0]], depth: room.y })
    faces.push({ key: room.id + '-east', room, kind: 'wall', side: 'east', poly: [floor[1], floor[2], top[2], top[1]], depth: room.x + room.width })
    faces.push({ key: room.id + '-south', room, kind: 'wall', side: 'south', poly: [floor[2], floor[3], top[3], top[2]], depth: room.y + room.depth + 10 })
    faces.push({ key: room.id + '-west', room, kind: 'wall', side: 'west', poly: [floor[3], floor[0], top[0], top[3]], depth: room.x + 10 })
  })

  return <svg className="planner-svg planner-svg--3d" viewBox="0 0 1400 900" role="img" aria-label="Трёхмерная модель помещений">
    <defs><pattern id="iso-grid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M 34 0 L 0 0 0 34" fill="none" className="grid-small" /></pattern></defs>
    <rect width="1400" height="900" fill="url(#iso-grid)" />
    {faces.sort((a, b) => a.depth - b.depth).map((face) => {
      const activeRoom = selected.type === 'room' && selected.id === face.room.id
      const activeWall = activeRoom && face.side && selected.side === face.side
      return <polygon key={face.key} points={pts(face.poly)} className={'iso-face ' + face.kind + ' ' + (activeRoom ? 'active-room ' : '') + (activeWall ? 'active-wall' : '')} onClick={() => setSelected({ type: 'room', id: face.room.id, side: face.side || selected.side || 'north' })} />
    })}
    {project.rooms.map((room) => {
      const p = projectPoint(room.x + room.width / 2, room.y + room.depth / 2, room.height + 35, angle, center)
      return <g key={room.id + '-label'} pointerEvents="none"><text className="iso-label" x={p.x} y={p.y} textAnchor="middle">{room.name}</text><text className="iso-area" x={p.x} y={p.y + 18} textAnchor="middle">{(room.width * room.depth / 10000).toFixed(1)} м²</text></g>
    })}
    {project.freeWalls.map((wall) => {
      const a0 = projectPoint(wall.x1, wall.y1, 0, angle, center)
      const b0 = projectPoint(wall.x2, wall.y2, 0, angle, center)
      const a1 = projectPoint(wall.x1, wall.y1, wall.height, angle, center)
      const b1 = projectPoint(wall.x2, wall.y2, wall.height, angle, center)
      const active = selected.type === 'wall' && selected.id === wall.id
      return <polygon key={wall.id} points={pts([a0, b0, b1, a1])} className={'iso-free-wall ' + (active ? 'active-wall' : '')} onClick={() => setSelected({ type: 'wall', id: wall.id })} />
    })}
  </svg>
}

function MaterialsView({ project, onPriceChange }) {
  const metrics = useMemo(() => projectMetrics(project), [project])
  const rows = useMemo(() => buildTakeoff(project), [project])
  const grouped = rows.reduce((acc, row) => {
    ;(acc[row.group] ||= []).push(row)
    return acc
  }, {})
  const rowKey = (row) => row.group + '|' + row.name
  const totalBudget = rows.reduce((sum, row) => sum + row.qty * (Number(project.prices?.[rowKey(row)]) || 0), 0)
  return <div className="planner-report">
    <div className="planner-kpis">
      <div><small>Пол / потолок</small><strong>{metrics.floorArea.toFixed(1)} м²</strong></div>
      <div><small>Стены под отделку</small><strong>{metrics.wallArea.toFixed(1)} м²</strong></div>
      <div><small>Плинтус</small><strong>{metrics.baseboard.toFixed(1)} м</strong></div>
      <div><small>Проёмы</small><strong>{metrics.openingCount} шт</strong></div>
    </div>
    <div className="planner-report-note"><b>Ведомость автоматически пересчитывается из геометрии.</b><span>Запасы и нормы здесь служат отправной точкой закупки. Перед заказом конструкционных материалов проверьте конкретную систему производителя, раскладку, основание и проектные требования.</span></div>
    <div className="planner-budget-total"><span>Ориентир по введённым ценам</span><strong>{Math.round(totalBudget).toLocaleString('ru-RU')} ₽</strong></div>
    {Object.entries(grouped).map(([group, items]) => <section className="material-group" key={group}><div className="material-group__title"><span>{group}</span><small>{items.length} поз.</small></div>{items.map((row, index) => { const key = rowKey(row); const price = project.prices?.[key] ?? ''; return <div className="material-row" key={row.name + index}><div className="material-name"><strong>{row.name}</strong><small>{row.note}</small><a href={lemanaSearch(row.name)} target="_blank" rel="noreferrer">Подобрать в Лемана ПРО ↗</a></div><span>{row.qty} {row.unit}</span><label className="material-price"><input type="number" min="0" step="1" value={price} placeholder="цена" onChange={(e) => onPriceChange(key, e.target.value)} /><small>₽ / {row.unit}</small></label><b>запас {row.reserve}</b></div> })}</section>)}
  </div>
}

function ReadinessView({ project }) {
  const metrics = projectMetrics(project)
  const checks = [
    ['Геометрия помещений', project.rooms.length > 0, project.rooms.length + ' помещений'],
    ['Высоты заданы', project.rooms.every((room) => room.height >= 180), 'по каждому помещению'],
    ['Материалы стен выбраны', project.rooms.every((room) => SIDES.every((side) => room.walls[side].material)), 'для всех стен'],
    ['Отделка стен выбрана', project.rooms.every((room) => SIDES.every((side) => room.walls[side].finish)), 'для расчёта площадей'],
    ['Двери и окна внесены', metrics.openingCount > 0, metrics.openingCount ? metrics.openingCount + ' проёмов' : 'проверьте, не забыты ли проёмы'],
    ['Свободные стены проверены', project.freeWalls.every((wall) => wallLengthFree(wall) >= 20), project.freeWalls.length + ' отдельных стен'],
  ]
  const ready = checks.filter((item) => item[1]).length
  return <div className="planner-readiness">
    <div className="readiness-score"><div><span>{ready}/{checks.length}</span><strong>подготовлено</strong></div><p>Этот экран помогает перед началом работ поймать пропущенные размеры и параметры. Он не заменяет конструктивный проект для несущих изменений, газа, электрики и инженерных систем.</p></div>
    <div className="readiness-list">{checks.map(([name, ok, note]) => <div key={name} className={ok ? 'ok' : 'warn'}><span>{ok ? '✓' : '!'}</span><div><strong>{name}</strong><small>{note}</small></div></div>)}</div>
    <div className="construction-sequence">
      <strong>Что зафиксировать до закупки</strong>
      <ol>
        <li>Контрольный обмер после демонтажа: стены, диагонали, высоты, перепады.</li>
        <li>Все проёмы и направления открывания дверей, реальные габариты окон и подоконников.</li>
        <li>Состав каждой новой перегородки: толщина, профиль/блок, число слоёв, звукоизоляция.</li>
        <li>Чистовые отметки пола и потолка, толщины плитки, клея, стяжки и напольного покрытия.</li>
        <li>Точки воды, канализации, вентиляции, электрики и места оборудования до зашивки стен.</li>
        <li>После этого — финальная ведомость материалов с артикулами и партиями.</li>
      </ol>
    </div>
  </div>
}

export default function PlannerPage() {
  const [project, setProject] = useState(getInitialProject)
  const [selected, setSelected] = useState(() => ({ type: 'room', id: getInitialProject().rooms[0]?.id || '', side: 'north' }))
  const [tab, setTab] = useState('plan')
  const [view, setView] = useState('2d')
  const [angle, setAngle] = useState(-18)
  const [notice, setNotice] = useState('')
  const past = useRef([])
  const future = useRef([])
  const dragSnapshot = useRef(null)
  const importRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
  }, [project])

  const commit = (updater) => {
    setProject((current) => {
      past.current = [...past.current.slice(-39), current]
      future.current = []
      return typeof updater === 'function' ? updater(current) : updater
    })
  }
  const undo = () => {
    if (!past.current.length) return
    setProject((current) => {
      const previous = past.current[past.current.length - 1]
      past.current = past.current.slice(0, -1)
      future.current = [current, ...future.current].slice(0, 40)
      return previous
    })
  }
  const redo = () => {
    if (!future.current.length) return
    setProject((current) => {
      const next = future.current[0]
      future.current = future.current.slice(1)
      past.current = [...past.current.slice(-39), current]
      return next
    })
  }

  const selectedRoom = selected.type === 'room' ? project.rooms.find((room) => room.id === selected.id) : null
  const selectedWall = selected.type === 'wall' ? project.freeWalls.find((wall) => wall.id === selected.id) : null
  useEffect(() => {
    if (selected.type === 'room' && !selectedRoom && project.rooms[0]) setSelected({ type: 'room', id: project.rooms[0].id, side: 'north' })
    if (selected.type === 'wall' && !selectedWall && project.rooms[0]) setSelected({ type: 'room', id: project.rooms[0].id, side: 'north' })
  }, [project.rooms.length, project.freeWalls.length])

  const updateRoom = (patch, sideOverride) => {
    if (sideOverride) setSelected((s) => ({ ...s, side: sideOverride }))
    if (!selectedRoom || !Object.keys(patch).length) return
    commit((current) => ({ ...current, rooms: current.rooms.map((room) => room.id === selectedRoom.id ? { ...room, ...patch } : room) }))
  }
  const updateRoomWall = (patch, replace = false) => {
    if (!selectedRoom) return
    commit((current) => ({
      ...current,
      rooms: current.rooms.map((room) => {
        if (room.id !== selectedRoom.id) return room
        const currentWall = room.walls[selected.side]
        const nextWall = replace ? patch : { ...currentWall, ...patch }
        return { ...room, walls: { ...room.walls, [selected.side]: nextWall } }
      }),
    }))
  }
  const updateFreeWall = (patch, replace = false) => {
    if (!selectedWall) return
    commit((current) => ({ ...current, freeWalls: current.freeWalls.map((wall) => wall.id === selectedWall.id ? (replace ? patch : { ...wall, ...patch }) : wall) }))
  }
  const addRoom = () => {
    const room = makeRoom(project.rooms.length)
    commit((current) => ({ ...current, rooms: [...current.rooms, room] }))
    setSelected({ type: 'room', id: room.id, side: 'north' })
    setTab('plan')
  }
  const addFreeWall = () => {
    const wall = makeFreeWall(project.freeWalls.length)
    commit((current) => ({ ...current, freeWalls: [...current.freeWalls, wall] }))
    setSelected({ type: 'wall', id: wall.id })
    setTab('plan')
  }
  const deleteSelectedRoom = () => {
    if (!selectedRoom) return
    commit((current) => ({ ...current, rooms: current.rooms.filter((room) => room.id !== selectedRoom.id) }))
  }
  const duplicateRoom = () => {
    if (!selectedRoom) return
    const copy = normalizeProject({ rooms: [{ ...selectedRoom, id: uid('room'), name: selectedRoom.name + ' копия', x: selectedRoom.x + project.grid * 2, y: selectedRoom.y + project.grid * 2 }], freeWalls: [] }).rooms[0]
    commit((current) => ({ ...current, rooms: [...current.rooms, copy] }))
    setSelected({ type: 'room', id: copy.id, side: 'north' })
  }
  const deleteSelectedWall = () => {
    if (!selectedWall) return
    commit((current) => ({ ...current, freeWalls: current.freeWalls.filter((wall) => wall.id !== selectedWall.id) }))
  }

  const dragRoom = (id, x, y, done) => {
    if (!done) {
      if (!dragSnapshot.current) dragSnapshot.current = project
      setProject((current) => ({ ...current, rooms: current.rooms.map((room) => room.id === id ? { ...room, x: clamp(x, 0, 5000), y: clamp(y, 0, 5000) } : room) }))
      return
    }
    if (dragSnapshot.current) {
      past.current = [...past.current.slice(-39), dragSnapshot.current]
      future.current = []
      dragSnapshot.current = null
    }
  }

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'dom-planner-project.json'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice('Проект экспортирован в JSON')
  }
  const importProject = async (file) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const next = normalizeProject(parsed)
      commit(next)
      setSelected({ type: 'room', id: next.rooms[0]?.id || '', side: 'north' })
      setNotice('Проект импортирован')
    } catch {
      setNotice('Не удалось прочитать файл проекта')
    }
  }
  const resetProject = () => {
    const next = sampleProject()
    commit(next)
    setSelected({ type: 'room', id: next.rooms[0].id, side: 'north' })
    setNotice('Загружен демонстрационный план')
  }

  const metrics = useMemo(() => projectMetrics(project), [project])

  return <main className="planner-page">
    <header className="planner-topbar">
      <div>
        <span className="planner-kicker">3D ПЛАНИРОВЩИК / DOM CAD</span>
        <input className="planner-project-name" value={project.name} onChange={(e) => commit((current) => ({ ...current, name: e.target.value.slice(0, 80) }))} aria-label="Название проекта" />
        <p>Обмерный план, стены, проёмы, отделка и автоматическая ведомость материалов в одном проекте.</p>
      </div>
      <div className="planner-top-actions">
        <button type="button" onClick={undo} disabled={!past.current.length}>↶ Назад</button>
        <button type="button" onClick={redo} disabled={!future.current.length}>↷ Вперёд</button>
        <button type="button" onClick={exportProject}>Экспорт</button>
        <button type="button" onClick={() => importRef.current?.click()}>Импорт</button>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => importProject(e.target.files?.[0])} />
      </div>
    </header>

    <div className="planner-tabs" role="tablist">
      <button type="button" className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}>План и 3D</button>
      <button type="button" className={tab === 'materials' ? 'active' : ''} onClick={() => setTab('materials')}>Материалы</button>
      <button type="button" className={tab === 'readiness' ? 'active' : ''} onClick={() => setTab('readiness')}>Перед началом работ</button>
      <div className="planner-tabs__summary"><span>{project.rooms.length} помещений</span><b>{metrics.floorArea.toFixed(1)} м²</b></div>
    </div>

    {tab === 'plan' && <div className="planner-workspace">
      <aside className="planner-objects">
        <div className="planner-panel-head"><div><span>ОБЪЕКТЫ</span><strong>Помещения и стены</strong></div><button type="button" onClick={addRoom}>+ Комната</button></div>
        <div className="planner-object-list">
          {project.rooms.map((room) => <button type="button" key={room.id} className={selected.type === 'room' && selected.id === room.id ? 'active' : ''} onClick={() => setSelected({ type: 'room', id: room.id, side: 'north' })}><span className="object-index">{String(project.rooms.indexOf(room) + 1).padStart(2, '0')}</span><div><strong>{room.name}</strong><small>{room.width} × {room.depth} см · {(room.width * room.depth / 10000).toFixed(1)} м²</small></div></button>)}
        </div>
        <button className="planner-add-wall" type="button" onClick={addFreeWall}>+ Добавить свободную стену</button>
        {project.freeWalls.length > 0 && <div className="planner-object-list planner-object-list--walls">{project.freeWalls.map((wall) => <button type="button" key={wall.id} className={selected.type === 'wall' && selected.id === wall.id ? 'active' : ''} onClick={() => setSelected({ type: 'wall', id: wall.id })}><span className="object-index">W</span><div><strong>{wall.name}</strong><small>{(wallLengthFree(wall) / 100).toFixed(2)} м · {wall.height} см</small></div></button>)}</div>}
        <div className="planner-grid-control"><span>Привязка к сетке</span><select value={project.grid} onChange={(e) => commit((current) => ({ ...current, grid: Number(e.target.value) }))}><option value="10">10 см</option><option value="20">20 см</option><option value="50">50 см</option></select></div>
        <button className="planner-reset" type="button" onClick={resetProject}>Загрузить пример заново</button>
      </aside>

      <section className="planner-stage">
        <div className="planner-stage-toolbar">
          <div className="view-switch"><button type="button" className={view === '2d' ? 'active' : ''} onClick={() => setView('2d')}>2D план</button><button type="button" className={view === '3d' ? 'active' : ''} onClick={() => setView('3d')}>3D вид</button></div>
          {view === '3d' && <div className="angle-control"><button type="button" onClick={() => setAngle((a) => a - 15)}>↶</button><span>{angle}°</span><button type="button" onClick={() => setAngle((a) => a + 15)}>↷</button></div>}
          <div className="stage-hint">{view === '2d' ? 'Перетаскивайте помещения. Клик по границе выбирает конкретную стену.' : 'Кликните по стене или комнате, чтобы открыть её параметры.'}</div>
        </div>
        <div className="planner-canvas">
          {view === '2d' ? <FloorPlan2D project={project} selected={selected} setSelected={setSelected} onDragRoom={dragRoom} /> : <FloorPlan3D project={project} selected={selected} setSelected={setSelected} angle={angle} />}
        </div>
        <div className="planner-scale"><i /><span>100 см</span></div>
      </section>

      <aside className="planner-inspector">
        <div className="planner-panel-head"><div><span>ПАРАМЕТРЫ</span><strong>{selectedRoom ? selectedRoom.name : selectedWall ? selectedWall.name : 'Выберите объект'}</strong></div></div>
        {selectedRoom && <RoomInspector room={selectedRoom} side={selected.side || 'north'} onRoomChange={updateRoom} onWallChange={updateRoomWall} onDelete={deleteSelectedRoom} onDuplicate={duplicateRoom} />}
        {selectedWall && <FreeWallInspector wall={selectedWall} onChange={updateFreeWall} onDelete={deleteSelectedWall} />}
      </aside>
    </div>}

    {tab === 'materials' && <MaterialsView project={project} onPriceChange={(key, value) => commit((current) => ({ ...current, prices: { ...(current.prices || {}), [key]: value === '' ? '' : Math.max(0, Number(value) || 0) } }))} />}
    {tab === 'readiness' && <ReadinessView project={project} />}

    {notice && <div className="planner-toast" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')}>×</button></div>}
  </main>
}
