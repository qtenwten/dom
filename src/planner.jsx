import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  ENGINEERING_ITEMS,
  ENGINEERING_LAYERS,
  WALL_ASSEMBLIES,
  buildDrywallTakeoff,
  buildEngineeringTakeoff,
  engineeringItemsForLayer,
  normalizeEngineering,
  snapProjectPoint,
  validateProject,
} from './planner-engine.js'
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
    assembly: '',
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
    assembly: 'drywall-75-single',
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
    engineering: { electrical: [], plumbing: [], heating: [] },
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
          assembly: src.material === 'drywall' ? (WALL_ASSEMBLIES[src.assembly] ? src.assembly : 'drywall-75-single') : '',
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
      assembly: raw.material === 'drywall' ? (WALL_ASSEMBLIES[raw.assembly] ? raw.assembly : 'drywall-75-single') : '',
      openings: Array.isArray(raw.openings) ? raw.openings.slice(0, 30) : [],
    })) : [],
    engineering: normalizeEngineering(input.engineering),
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
    if (material === 'brick') {
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
  rows.push(...buildDrywallTakeoff(project), ...buildEngineeringTakeoff(project))
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
      <SelectInput label="Материал" value={wall.material} options={Object.entries(MATERIALS).map(([k, v]) => [k, v.label])} onChange={(material) => onWallChange({ material, assembly: material === 'drywall' ? (wall.assembly || 'drywall-75-single') : '' })} />
      <SelectInput label="Отделка" value={wall.finish} options={Object.entries(FINISHES)} onChange={(finish) => onWallChange({ finish })} />
    </div>
    {wall.material === 'drywall' && <SelectInput label="Пирог перегородки" value={wall.assembly || 'drywall-75-single'} options={Object.entries(WALL_ASSEMBLIES).map(([key, item]) => [key, item.label])} onChange={(assembly) => onWallChange({ assembly, thickness: WALL_ASSEMBLIES[assembly].thickness })} />}
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
      <SelectInput label="Материал" value={wall.material} options={Object.entries(MATERIALS).map(([k, v]) => [k, v.label])} onChange={(material) => onChange({ material, assembly: material === 'drywall' ? (wall.assembly || 'drywall-75-single') : '' })} />
      <SelectInput label="Отделка" value={wall.finish} options={Object.entries(FINISHES)} onChange={(finish) => onChange({ finish })} />
    </div>
    {wall.material === 'drywall' && <SelectInput label="Пирог перегородки" value={wall.assembly || 'drywall-75-single'} options={Object.entries(WALL_ASSEMBLIES).map(([key, item]) => [key, item.label])} onChange={(assembly) => onChange({ assembly, thickness: WALL_ASSEMBLIES[assembly].thickness })} />}
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

function FloorPlan2D({ project, selected, setSelected, onDragRoom, onResizeRoom, tool, layer, engineeringType, onAddFreeWall, onAddEngineering }) {
  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const resizeRef = useRef(null)
  const [drawStart, setDrawStart] = useState(null)
  const [hoverSnap, setHoverSnap] = useState(null)

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setDrawStart(null)
        setHoverSnap(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (tool !== 'wall') setDrawStart(null)
    if (tool === 'select') setHoverSnap(null)
  }, [tool, layer])

  const viewBox = useMemo(() => {
    const xs = []
    const ys = []
    project.rooms.forEach((room) => { xs.push(room.x, room.x + room.width); ys.push(room.y, room.y + room.depth) })
    project.freeWalls.forEach((wall) => { xs.push(wall.x1, wall.x2); ys.push(wall.y1, wall.y2) })
    if (!xs.length) return { x: 0, y: 0, width: 1400, height: 900 }
    const pad = 120
    const minX = Math.min(...xs) - pad
    const maxX = Math.max(...xs) + pad
    const minY = Math.min(...ys) - pad
    const maxY = Math.max(...ys) + pad
    let width = Math.max(1000, maxX - minX)
    let height = Math.max(650, maxY - minY)
    const aspect = 14 / 9
    if (width / height > aspect) height = width / aspect
    else width = height * aspect
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    return { x: centerX - width / 2, y: centerY - height / 2, width, height }
  }, [project.rooms, project.freeWalls])

  const pointFromEvent = (event) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    const box = svg.viewBox.baseVal
    return {
      x: box.x + (event.clientX - rect.left) * box.width / rect.width,
      y: box.y + (event.clientY - rect.top) * box.height / rect.height,
    }
  }

  const pointSnapped = (event, origin = null) => snapProjectPoint(project, pointFromEvent(event), origin)

  const handlePlanPointerDown = (event) => {
    if (event.button !== 0) return
    if (tool === 'wall') {
      const point = pointSnapped(event, drawStart)
      if (!drawStart) {
        setDrawStart(point)
        setHoverSnap(point)
        return
      }
      const length = Math.hypot(point.x - drawStart.x, point.y - drawStart.y)
      if (length >= 20) {
        onAddFreeWall({ x1: drawStart.x, y1: drawStart.y, x2: point.x, y2: point.y })
        setDrawStart(point)
        setHoverSnap(point)
      }
      return
    }
    if (tool === 'engineering' && layer !== 'architecture' && engineeringType) {
      const point = pointSnapped(event)
      onAddEngineering(layer, engineeringType, point)
    }
  }

  const startDrag = (event, room) => {
    if (tool !== 'select') return
    if (event.button !== 0) return
    event.stopPropagation()
    const point = pointFromEvent(event)
    dragRef.current = { id: room.id, dx: point.x - room.x, dy: point.y - room.y }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setSelected({ type: 'room', id: room.id, side: selected.id === room.id ? selected.side : 'north' })
  }

  const startResize = (event, room) => {
    if (tool !== 'select') return
    event.stopPropagation()
    const point = pointFromEvent(event)
    resizeRef.current = { id: room.id, startX: point.x, startY: point.y, width: room.width, depth: room.depth }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setSelected({ type: 'room', id: room.id, side: selected.id === room.id ? selected.side : 'north' })
  }

  const movePointer = (event) => {
    if (tool === 'wall' && drawStart) {
      setHoverSnap(pointSnapped(event, drawStart))
      return
    }
    if (tool === 'engineering') {
      setHoverSnap(pointSnapped(event))
    }
    if (resizeRef.current) {
      const point = pointFromEvent(event)
      const resize = resizeRef.current
      const width = clamp(snap(resize.width + point.x - resize.startX, project.grid), 50, 5000)
      const depth = clamp(snap(resize.depth + point.y - resize.startY, project.grid), 50, 5000)
      onResizeRoom(resize.id, width, depth, false)
      return
    }
    if (!dragRef.current) return
    const point = pointFromEvent(event)
    const drag = dragRef.current
    onDragRoom(drag.id, snap(point.x - drag.dx, project.grid), snap(point.y - drag.dy, project.grid), false)
  }

  const endPointer = () => {
    if (resizeRef.current) {
      onResizeRoom(resizeRef.current.id, null, null, true)
      resizeRef.current = null
    }
    if (dragRef.current) {
      onDragRoom(dragRef.current.id, null, null, true)
      dragRef.current = null
    }
  }

  const floorPattern = (finish) => ({
    laminate: 'planner-floor-laminate',
    parquet: 'planner-floor-parquet',
    tile: 'planner-floor-tile',
    vinyl: 'planner-floor-vinyl',
    screed: 'planner-floor-screed',
  }[finish] || 'planner-floor-neutral')
  const wallStroke = (wall) => clamp((wall?.thickness || 120) / 10, 8, 22)

  const openingGlyph = (room, side, opening) => {
    const line = openingLine(room, side, opening)
    const width = opening.width
    const vertical = side === 'east' || side === 'west'
    const cut = <line className="plan-opening-cut" x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
    if (opening.type === 'window') {
      const offset = 4
      return <g key={opening.id} className="plan-window">
        {cut}
        <line x1={line.x1 + (vertical ? -offset : 0)} y1={line.y1 + (vertical ? 0 : -offset)} x2={line.x2 + (vertical ? -offset : 0)} y2={line.y2 + (vertical ? 0 : -offset)} />
        <line x1={line.x1 + (vertical ? offset : 0)} y1={line.y1 + (vertical ? 0 : offset)} x2={line.x2 + (vertical ? offset : 0)} y2={line.y2 + (vertical ? 0 : offset)} />
      </g>
    }

    let leaf = null
    let arc = ''
    if (side === 'north') {
      leaf = [line.x1, line.y1, line.x1, line.y1 + width]
      arc = 'M ' + line.x2 + ' ' + line.y2 + ' A ' + width + ' ' + width + ' 0 0 1 ' + line.x1 + ' ' + (line.y1 + width)
    } else if (side === 'south') {
      leaf = [line.x1, line.y1, line.x1, line.y1 - width]
      arc = 'M ' + line.x2 + ' ' + line.y2 + ' A ' + width + ' ' + width + ' 0 0 0 ' + line.x1 + ' ' + (line.y1 - width)
    } else if (side === 'west') {
      leaf = [line.x1, line.y1, line.x1 + width, line.y1]
      arc = 'M ' + line.x2 + ' ' + line.y2 + ' A ' + width + ' ' + width + ' 0 0 0 ' + (line.x1 + width) + ' ' + line.y1
    } else {
      leaf = [line.x1, line.y1, line.x1 - width, line.y1]
      arc = 'M ' + line.x2 + ' ' + line.y2 + ' A ' + width + ' ' + width + ' 0 0 1 ' + (line.x1 - width) + ' ' + line.y1
    }
    return <g key={opening.id} className="plan-door">
      {cut}
      <line className="plan-door-leaf" x1={leaf[0]} y1={leaf[1]} x2={leaf[2]} y2={leaf[3]} />
      <path className="plan-door-swing" d={arc} />
    </g>
  }

  const freeOpeningGlyph = (wall, opening) => {
    const total = wallLengthFree(wall)
    if (!total) return null
    const ux = (wall.x2 - wall.x1) / total
    const uy = (wall.y2 - wall.y1) / total
    const nx = -uy
    const ny = ux
    const start = clamp(opening.offset, 0, total)
    const end = clamp(opening.offset + opening.width, start, total)
    const x1 = wall.x1 + ux * start
    const y1 = wall.y1 + uy * start
    const x2 = wall.x1 + ux * end
    const y2 = wall.y1 + uy * end
    if (opening.type === 'window') {
      return <g key={opening.id} className="plan-window">
        <line className="plan-opening-cut" x1={x1} y1={y1} x2={x2} y2={y2} />
        <line x1={x1 + nx * 4} y1={y1 + ny * 4} x2={x2 + nx * 4} y2={y2 + ny * 4} />
        <line x1={x1 - nx * 4} y1={y1 - ny * 4} x2={x2 - nx * 4} y2={y2 - ny * 4} />
      </g>
    }
    const leafX = x1 + nx * opening.width
    const leafY = y1 + ny * opening.width
    return <g key={opening.id} className="plan-door">
      <line className="plan-opening-cut" x1={x1} y1={y1} x2={x2} y2={y2} />
      <line className="plan-door-leaf" x1={x1} y1={y1} x2={leafX} y2={leafY} />
      <path className="plan-door-swing" d={'M ' + x2 + ' ' + y2 + ' A ' + opening.width + ' ' + opening.width + ' 0 0 1 ' + leafX + ' ' + leafY} />
    </g>
  }

  const engineeringItems = layer === 'architecture' ? [] : (project.engineering?.[layer] || [])

  return <svg ref={svgRef} className={'planner-svg tool-' + tool} viewBox={viewBox.x + ' ' + viewBox.y + ' ' + viewBox.width + ' ' + viewBox.height} role="img" aria-label="Редактируемый архитектурный план квартиры" onPointerDown={handlePlanPointerDown} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={endPointer}>
    <defs>
      <pattern id="planner-grid-small" width={project.grid} height={project.grid} patternUnits="userSpaceOnUse"><path d={'M ' + project.grid + ' 0 L 0 0 0 ' + project.grid} fill="none" className="grid-small" /></pattern>
      <pattern id="planner-grid-large" width={project.grid * 5} height={project.grid * 5} patternUnits="userSpaceOnUse"><rect width={project.grid * 5} height={project.grid * 5} fill="url(#planner-grid-small)" /><path d={'M ' + project.grid * 5 + ' 0 L 0 0 0 ' + project.grid * 5} fill="none" className="grid-large" /></pattern>
      <pattern id="planner-floor-laminate" width="80" height="24" patternUnits="userSpaceOnUse"><rect width="80" height="24" fill="#e5dcc8" /><path d="M0 0H80M0 24H80M40 0V24" className="floor-pattern-line" /></pattern>
      <pattern id="planner-floor-parquet" width="54" height="54" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="54" height="54" fill="#dfcfb4" /><path d="M0 0V54M18 0V54M36 0V54M54 0V54" className="floor-pattern-line" /></pattern>
      <pattern id="planner-floor-tile" width="42" height="42" patternUnits="userSpaceOnUse"><rect width="42" height="42" fill="#dfe3e0" /><path d="M42 0H0V42" className="floor-pattern-line" /></pattern>
      <pattern id="planner-floor-vinyl" width="64" height="32" patternUnits="userSpaceOnUse"><rect width="64" height="32" fill="#ddd7cb" /><path d="M0 0H64M0 32H64M32 0V32" className="floor-pattern-line faint" /></pattern>
      <pattern id="planner-floor-screed" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#d4d3cf" /><circle cx="5" cy="6" r="1" className="screed-dot" /><circle cx="18" cy="15" r=".8" className="screed-dot" /></pattern>
      <pattern id="planner-floor-neutral" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#ece8df" /></pattern>
      <filter id="planner-room-shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#111410" floodOpacity=".08" /></filter>
    </defs>
    <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} className="planner-paper" fill="url(#planner-grid-large)" />
    {project.rooms.map((room) => {
      const active = selected.type === 'room' && selected.id === room.id
      const walls = {
        north: [room.x, room.y, room.x + room.width, room.y],
        east: [room.x + room.width, room.y, room.x + room.width, room.y + room.depth],
        south: [room.x, room.y + room.depth, room.x + room.width, room.y + room.depth],
        west: [room.x, room.y, room.x, room.y + room.depth],
      }
      return <g key={room.id} className="plan-room-group" filter="url(#planner-room-shadow)">
        <rect className={'plan-room ' + (active ? 'active' : '')} style={{ fill: 'url(#' + floorPattern(room.floorFinish) + ')' }} x={room.x} y={room.y} width={room.width} height={room.depth} onPointerDown={(e) => startDrag(e, room)} />
        <text className="plan-room-name" x={room.x + room.width / 2} y={room.y + room.depth / 2 - 8} textAnchor="middle">{room.name}</text>
        <text className="plan-room-area" x={room.x + room.width / 2} y={room.y + room.depth / 2 + 18} textAnchor="middle">{(room.width * room.depth / 10000).toFixed(1)} м²</text>
        {active && <g className="plan-dimension-set">
          <line x1={room.x} y1={room.y - 34} x2={room.x + room.width} y2={room.y - 34} />
          <line x1={room.x} y1={room.y - 42} x2={room.x} y2={room.y - 26} />
          <line x1={room.x + room.width} y1={room.y - 42} x2={room.x + room.width} y2={room.y - 26} />
          <text x={room.x + room.width / 2} y={room.y - 42} textAnchor="middle">{room.width} см</text>
          <line x1={room.x - 34} y1={room.y} x2={room.x - 34} y2={room.y + room.depth} />
          <line x1={room.x - 42} y1={room.y} x2={room.x - 26} y2={room.y} />
          <line x1={room.x - 42} y1={room.y + room.depth} x2={room.x - 26} y2={room.y + room.depth} />
          <text x={room.x - 43} y={room.y + room.depth / 2} textAnchor="middle" transform={'rotate(-90 ' + (room.x - 43) + ' ' + (room.y + room.depth / 2) + ')'}>{room.depth} см</text>
        </g>}
        {SIDES.map((side) => {
          const points = walls[side]
          const wallActive = active && selected.side === side
          const wall = room.walls[side]
          return <g key={side}>
            <line className={'plan-wall-hit ' + (wallActive ? 'active' : '')} x1={points[0]} y1={points[1]} x2={points[2]} y2={points[3]} onPointerDown={(e) => { if (tool !== 'select') return; e.stopPropagation(); setSelected({ type: 'room', id: room.id, side }) }} />
            <line className={'plan-wall ' + (wallActive ? 'active' : '')} style={{ strokeWidth: wallStroke(wall) }} x1={points[0]} y1={points[1]} x2={points[2]} y2={points[3]} pointerEvents="none" />
            {wall.openings.map((opening) => openingGlyph(room, side, opening))}
          </g>
        })}
        {active && <g className="plan-resize-handle" onPointerDown={(event) => startResize(event, room)} transform={'translate(' + (room.x + room.width) + ' ' + (room.y + room.depth) + ')'}>
          <circle r="15" />
          <path d="M-6 0H6M0-6V6" />
        </g>}
      </g>
    })}
    {project.freeWalls.map((wall) => {
      const active = selected.type === 'wall' && selected.id === wall.id
      return <g key={wall.id} onPointerDown={(e) => { if (tool !== 'select') return; e.stopPropagation(); setSelected({ type: 'wall', id: wall.id }) }}>
        <line className={'free-wall-hit ' + (active ? 'active' : '')} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} />
        <line className={'free-wall-line ' + (active ? 'active' : '')} style={{ strokeWidth: wallStroke(wall) }} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} pointerEvents="none" />
        {wall.openings.map((opening) => freeOpeningGlyph(wall, opening))}
        <text className="plan-dimension" x={(wall.x1 + wall.x2) / 2} y={(wall.y1 + wall.y2) / 2 - 15} textAnchor="middle">{(wallLengthFree(wall) / 100).toFixed(2)} м</text>
      </g>
    })}
    {engineeringItems.map((item) => {
      const spec = ENGINEERING_ITEMS[item.type] || { glyph: '?', label: item.type }
      const active = selected.type === 'engineering' && selected.id === item.id
      return <g key={item.id} className={'engineering-point layer-' + layer + (active ? ' active' : '')} transform={'translate(' + item.x + ' ' + item.y + ')'} onPointerDown={(e) => { if (tool !== 'select') return; e.stopPropagation(); setSelected({ type: 'engineering', layer, id: item.id }) }}>
        <circle r="17" />
        <text textAnchor="middle" dominantBaseline="central">{spec.glyph}</text>
        <title>{spec.label} · {item.height} см</title>
      </g>
    })}
    {drawStart && hoverSnap && tool === 'wall' && <g className="planner-draw-preview" pointerEvents="none">
      <line x1={drawStart.x} y1={drawStart.y} x2={hoverSnap.x} y2={hoverSnap.y} />
      <circle cx={drawStart.x} cy={drawStart.y} r="7" />
      <circle cx={hoverSnap.x} cy={hoverSnap.y} r="9" />
      <text x={(drawStart.x + hoverSnap.x) / 2} y={(drawStart.y + hoverSnap.y) / 2 - 14} textAnchor="middle">{(Math.hypot(hoverSnap.x - drawStart.x, hoverSnap.y - drawStart.y) / 100).toFixed(2)} м · {hoverSnap.label}</text>
    </g>}
    {!drawStart && hoverSnap && tool === 'engineering' && <g className="planner-snap-preview" pointerEvents="none"><circle cx={hoverSnap.x} cy={hoverSnap.y} r="8" /><text x={hoverSnap.x + 12} y={hoverSnap.y - 12}>{hoverSnap.label}</text></g>}
  </svg>
}

function FloorPlan3D({ project, selected, setSelected, angle }) {
  const mountRef = useRef(null)
  const stateRef = useRef(null)

  const setCameraPreset = (preset) => {
    const state = stateRef.current
    if (!state) return
    const radius = state.radius || 8
    const height = state.maxHeight || 2.7
    state.controls.target.set(0, Math.min(1.3, height * .42), 0)
    if (preset === 'top') {
      state.camera.position.set(.001, Math.max(radius * 1.75, height + 5), .001)
    } else if (preset === 'front') {
      state.camera.position.set(0, Math.max(2.4, height * .75), radius * 1.55)
    } else {
      const rad = -38 * Math.PI / 180
      state.camera.position.set(Math.sin(rad) * radius * 1.35, Math.max(5.2, radius * .82), Math.cos(rad) * radius * 1.35)
    }
    state.camera.lookAt(state.controls.target)
    state.controls.update()
  }

  const capturePng = () => {
    const state = stateRef.current
    if (!state) return
    state.renderer.render(state.scene, state.camera)
    state.renderer.domElement.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = (project.name || 'dom-project').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '') + '-3d.png'
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    }, 'image/png')
  }

  useEffect(() => {
    const host = mountRef.current
    if (!host) return undefined

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xe9e5dc)
    scene.fog = new THREE.Fog(0xe9e5dc, 20, 42)

    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 120)
    camera.position.set(8.5, 8, 10.5)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    host.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = .075
    controls.target.set(0, 1.1, 0)
    controls.minDistance = 2.8
    controls.maxDistance = 34
    controls.maxPolarAngle = Math.PI * .495
    controls.screenSpacePanning = true

    scene.add(new THREE.HemisphereLight(0xfffbef, 0x626961, 2.25))
    const sun = new THREE.DirectionalLight(0xfff3d6, 3.8)
    sun.position.set(-9, 14, 8)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -18
    sun.shadow.camera.right = 18
    sun.shadow.camera.top = 18
    sun.shadow.camera.bottom = -18
    sun.shadow.bias = -.00025
    scene.add(sun)

    const fill = new THREE.DirectionalLight(0xdce8ef, 1.05)
    fill.position.set(9, 6, -7)
    scene.add(fill)

    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xdad5cb, roughness: 1, metalness: 0 })
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -.075
    ground.receiveShadow = true
    scene.add(ground)

    const grid = new THREE.GridHelper(36, 72, 0xb8b1a5, 0xcdc6bb)
    grid.position.y = -.06
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
    gridMaterials.forEach((material) => { material.transparent = true; material.opacity = .28 })
    scene.add(grid)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const state = { scene, camera, renderer, controls, pickables: [], model: null, grid, radius: 8, maxHeight: 2.7, framed: false }
    stateRef.current = state

    const resize = () => {
      const rect = host.getBoundingClientRect()
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    let down = null
    const updatePointer = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      return raycaster.intersectObjects(state.pickables, false)[0]
    }
    const onPointerDown = (event) => {
      down = { x: event.clientX, y: event.clientY }
    }
    const onPointerMove = (event) => {
      if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) {
        renderer.domElement.style.cursor = 'grabbing'
        return
      }
      const hit = updatePointer(event)
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
    }
    const onPointerUp = (event) => {
      if (!down) return
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
      down = null
      renderer.domElement.style.cursor = 'grab'
      if (moved > 5) return
      const hit = updatePointer(event)
      const selection = hit?.object?.userData?.selection
      if (selection) setSelected(selection)
    }
    const onPointerCancel = () => { down = null }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointercancel', onPointerCancel)

    let frame = 0
    const draw = () => {
      controls.update()
      renderer.render(scene, camera)
      frame = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel)
      controls.dispose()
      if (state.model) {
        state.model.traverse((object) => {
          object.geometry?.dispose?.()
          if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose?.())
          else object.material?.dispose?.()
          object.material?.map?.dispose?.()
        })
      }
      gridMaterials.forEach((material) => material.dispose?.())
      ground.geometry.dispose()
      groundMaterial.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      stateRef.current = null
    }
  }, [setSelected])

  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    const { scene } = state
    if (state.model) {
      scene.remove(state.model)
      state.model.traverse((object) => {
        object.geometry?.dispose?.()
        if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose?.())
        else object.material?.dispose?.()
        object.material?.map?.dispose?.()
      })
    }

    const model = new THREE.Group()
    const xs = []
    const ys = []
    project.rooms.forEach((room) => { xs.push(room.x, room.x + room.width); ys.push(room.y, room.y + room.depth) })
    project.freeWalls.forEach((wall) => { xs.push(wall.x1, wall.x2); ys.push(wall.y1, wall.y2) })
    const center = {
      x: xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0,
      y: ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0,
    }
    const floorColors = {
      laminate: 0xcfbd9a,
      tile: 0xc9d3d0,
      vinyl: 0xbeb8ab,
      parquet: 0xc6a777,
      screed: 0xb9b9b4,
    }
    const wallColors = {
      existing: 0xf1eee6,
      concrete: 0xbdbdb8,
      brick: 0xc9a68e,
      block: 0xd8d6c9,
      drywall: 0xf5f2e9,
    }
    const finishTint = {
      'plaster-paint': 0xffffff,
      tile: 0xe9f0ee,
      wallpaper: 0xf0e8d9,
      panels: 0xe4d5bf,
      none: 0xd6d2c9,
    }
    const blendHex = (a, b, t = .22) => {
      const ca = new THREE.Color(a)
      ca.lerp(new THREE.Color(b), t)
      return ca
    }
    const makeWallMaterial = (wall, selectedPart = false) => new THREE.MeshStandardMaterial({
      color: selectedPart ? 0xc89036 : blendHex(wallColors[wall.material] || 0xeeeae1, finishTint[wall.finish] || 0xffffff, .18),
      roughness: wall.finish === 'tile' ? .48 : wall.material === 'concrete' ? .94 : .8,
      metalness: 0,
    })
    const makeFloorMaterial = (finish, active) => new THREE.MeshStandardMaterial({
      color: active ? 0xc99a49 : (floorColors[finish] || 0xd7d0c2),
      roughness: finish === 'tile' ? .5 : .78,
      metalness: 0,
    })
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xe9e5dc, roughness: .58, metalness: .08 })
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0xa98967, roughness: .72, metalness: 0 })
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x9fc5d0,
      transparent: true,
      opacity: .30,
      roughness: .12,
      metalness: 0,
      transmission: .42,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    state.pickables = []

    const addMesh = (geometry, material, position, rotationY, selection, parent = model, pickable = true) => {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(position.x, position.y, position.z)
      if (rotationY) mesh.rotation.y = rotationY
      mesh.castShadow = material !== glassMaterial
      mesh.receiveShadow = true
      if (selection) mesh.userData.selection = selection
      parent.add(mesh)
      if (selection && pickable) state.pickables.push(mesh)
      return mesh
    }

    const wallCoordsForRoom = (room, side) => {
      if (side === 'north') return { x1: room.x, y1: room.y, x2: room.x + room.width, y2: room.y }
      if (side === 'south') return { x1: room.x, y1: room.y + room.depth, x2: room.x + room.width, y2: room.y + room.depth }
      if (side === 'west') return { x1: room.x, y1: room.y, x2: room.x, y2: room.y + room.depth }
      return { x1: room.x + room.width, y1: room.y, x2: room.x + room.width, y2: room.y + room.depth }
    }

    const addSegment = (coords, thicknessMm, material, selection, start, end, bottom, top) => {
      if (end <= start || top <= bottom) return
      const dx = coords.x2 - coords.x1
      const dy = coords.y2 - coords.y1
      const total = Math.hypot(dx, dy)
      if (!total) return
      const ux = dx / total
      const uy = dy / total
      const mid = (start + end) / 2
      const x = (coords.x1 + ux * mid - center.x) / 100
      const z = (coords.y1 + uy * mid - center.y) / 100
      const length = (end - start) / 100
      const height = (top - bottom) / 100
      const thickness = Math.max(.04, (thicknessMm || 120) / 1000)
      addMesh(
        new THREE.BoxGeometry(length, height, thickness),
        material,
        { x, y: (bottom + top) / 200, z },
        -Math.atan2(dy, dx),
        selection
      )
    }

    const addOpeningFixture = (coords, wall, opening, selection) => {
      const dx = coords.x2 - coords.x1
      const dy = coords.y2 - coords.y1
      const total = Math.hypot(dx, dy)
      if (!total) return
      const ux = dx / total
      const uy = dy / total
      const width = clamp(opening.width, 1, total) / 100
      const height = clamp(opening.height, 1, 1000) / 100
      const sill = opening.type === 'door' ? 0 : clamp(opening.sill, 0, 1000) / 100
      const offset = clamp(opening.offset, 0, total) + clamp(opening.width, 1, total) / 2
      const group = new THREE.Group()
      group.position.set(
        (coords.x1 + ux * offset - center.x) / 100,
        sill,
        (coords.y1 + uy * offset - center.y) / 100
      )
      group.rotation.y = -Math.atan2(dy, dx)
      model.add(group)

      const frame = .045
      const depth = Math.max(.045, (wall.thickness || 120) / 1000 + .012)
      const verticalHeight = height
      const makePart = (geometry, material, x, y, z, pickable = false) => {
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, y, z)
        mesh.castShadow = material !== glassMaterial
        mesh.receiveShadow = true
        if (selection) mesh.userData.selection = selection
        group.add(mesh)
        if (selection && pickable) state.pickables.push(mesh)
        return mesh
      }
      makePart(new THREE.BoxGeometry(frame, verticalHeight, depth), frameMaterial, -width / 2 + frame / 2, verticalHeight / 2, 0, true)
      makePart(new THREE.BoxGeometry(frame, verticalHeight, depth), frameMaterial, width / 2 - frame / 2, verticalHeight / 2, 0, true)
      makePart(new THREE.BoxGeometry(width, frame, depth), frameMaterial, 0, verticalHeight - frame / 2, 0, true)
      if (opening.type === 'window') {
        makePart(new THREE.BoxGeometry(width, frame, depth), frameMaterial, 0, frame / 2, 0, true)
        makePart(new THREE.BoxGeometry(Math.max(.04, width - frame * 2), Math.max(.04, verticalHeight - frame * 2), .018), glassMaterial, 0, verticalHeight / 2, 0, true)
        if (width > 1.2) makePart(new THREE.BoxGeometry(frame * .72, Math.max(.04, verticalHeight - frame * 2), depth * .75), frameMaterial, 0, verticalHeight / 2, 0)
      } else {
        const pivot = new THREE.Group()
        pivot.position.set(-width / 2 + frame, 0, depth * .55)
        pivot.rotation.y = -Math.PI / 9
        group.add(pivot)
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.05, width - frame * 2), Math.max(.05, verticalHeight - frame * 1.8), .035), doorMaterial)
        leaf.position.set((width - frame * 2) / 2, verticalHeight / 2, 0)
        leaf.castShadow = true
        leaf.receiveShadow = true
        leaf.userData.selection = selection
        pivot.add(leaf)
        state.pickables.push(leaf)
      }
    }

    const buildWallWithOpenings = (coords, wall, wallHeight, selection, selectedPart) => {
      const total = Math.hypot(coords.x2 - coords.x1, coords.y2 - coords.y1)
      const material = makeWallMaterial(wall, selectedPart)
      const openings = [...wall.openings]
        .map((opening) => ({
          ...opening,
          offset: clamp(opening.offset, 0, total),
          width: clamp(opening.width, 1, total),
          height: clamp(opening.height, 1, wallHeight),
          sill: clamp(opening.sill, 0, wallHeight),
        }))
        .sort((a, b) => a.offset - b.offset)
      let cursor = 0
      openings.forEach((opening) => {
        const start = clamp(opening.offset, 0, total)
        const end = clamp(opening.offset + opening.width, start, total)
        addSegment(coords, wall.thickness, material, selection, cursor, start, 0, wallHeight)
        if (opening.type === 'door') {
          addSegment(coords, wall.thickness, material, selection, start, end, opening.height, wallHeight)
        } else {
          const top = clamp(opening.sill + opening.height, opening.sill, wallHeight)
          addSegment(coords, wall.thickness, material, selection, start, end, 0, opening.sill)
          addSegment(coords, wall.thickness, material, selection, start, end, top, wallHeight)
        }
        addOpeningFixture(coords, wall, opening, selection)
        cursor = Math.max(cursor, end)
      })
      addSegment(coords, wall.thickness, material, selection, cursor, total, 0, wallHeight)
    }

    project.rooms.forEach((room) => {
      const isSelectedRoom = selected.type === 'room' && selected.id === room.id
      addMesh(
        new THREE.BoxGeometry(room.width / 100, .075, room.depth / 100),
        makeFloorMaterial(room.floorFinish, isSelectedRoom),
        { x: (room.x + room.width / 2 - center.x) / 100, y: -.018, z: (room.y + room.depth / 2 - center.y) / 100 },
        0,
        { type: 'room', id: room.id, side: selected.side || 'north' }
      )
      SIDES.forEach((side) => {
        const wall = room.walls[side]
        const selection = { type: 'room', id: room.id, side }
        buildWallWithOpenings(wallCoordsForRoom(room, side), wall, room.height, selection, isSelectedRoom && selected.side === side)
      })
    })

    project.freeWalls.forEach((wall) => {
      const length = wallLengthFree(wall)
      if (length <= 0) return
      const coords = { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 }
      const selection = { type: 'wall', id: wall.id }
      buildWallWithOpenings(coords, wall, wall.height, selection, selected.type === 'wall' && selected.id === wall.id)
    })

    state.model = model
    scene.add(model)

    const spanX = xs.length ? (Math.max(...xs) - Math.min(...xs)) / 100 : 6
    const spanY = ys.length ? (Math.max(...ys) - Math.min(...ys)) / 100 : 6
    const roomHeights = project.rooms.map((room) => room.height / 100)
    const wallHeights = project.freeWalls.map((wall) => wall.height / 100)
    const maxHeight = Math.max(2.4, ...roomHeights, ...wallHeights)
    const radius = Math.max(6.5, Math.max(spanX, spanY) * 1.15, maxHeight * 2.4)
    state.radius = radius
    state.maxHeight = maxHeight
    state.controls.maxDistance = Math.max(20, radius * 2.8)
    if (!state.framed) {
      state.framed = true
      const rad = -38 * Math.PI / 180
      state.camera.position.set(Math.sin(rad) * radius * 1.35, Math.max(5.2, radius * .82), Math.cos(rad) * radius * 1.35)
      state.controls.target.set(0, Math.min(1.3, maxHeight * .42), 0)
      state.camera.lookAt(state.controls.target)
      state.controls.update()
    }
  }, [project, selected])

  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    const radius = Math.max(state.radius || 6, Math.hypot(state.camera.position.x, state.camera.position.z))
    const rad = angle * Math.PI / 180
    state.camera.position.x = Math.sin(rad) * radius
    state.camera.position.z = Math.cos(rad) * radius
    state.camera.position.y = Math.max(5.2, radius * .72)
    state.camera.lookAt(state.controls.target)
    state.controls.update()
  }, [angle])

  const selectedName = selected.type === 'room'
    ? project.rooms.find((room) => room.id === selected.id)?.name
    : project.freeWalls.find((wall) => wall.id === selected.id)?.name

  return <div className="planner-three" ref={mountRef} role="img" aria-label="Интерактивная 3D модель квартиры">
    <div className="planner-three__legend"><span>Клик — выбрать</span><span>Drag — вращать</span><span>Колесо — масштаб</span></div>
    <div className="planner-three__camera">
      <button type="button" onClick={() => setCameraPreset('iso')}>Изометрия</button>
      <button type="button" onClick={() => setCameraPreset('top')}>Сверху</button>
      <button type="button" onClick={() => setCameraPreset('front')}>Фасад</button>
      <button type="button" onClick={capturePng}>PNG</button>
    </div>
    {selectedName && <div className="planner-three__selection"><small>Выбрано</small><strong>{selectedName}</strong>{selected.type === 'room' && selected.side && <span>{SIDE_NAMES[selected.side]} стена</span>}</div>}
  </div>
}

function EngineeringPalette({ layer, activeType, onChoose, onSelectMode }) {
  const items = engineeringItemsForLayer(layer)
  return <div className="engineering-palette">
    <div className="planner-panel-head"><div><span>{ENGINEERING_LAYERS[layer]?.short}</span><strong>{ENGINEERING_LAYERS[layer]?.label}</strong></div><button type="button" onClick={onSelectMode}>Выбрать</button></div>
    <p>Выберите элемент и кликайте по плану. Координаты магнитятся к сетке, углам и серединам стен.</p>
    <div className="engineering-palette__grid">{items.map(([key, item]) => <button key={key} type="button" className={activeType === key ? 'active' : ''} onClick={() => onChoose(key)}><b>{item.glyph}</b><span>{item.label}</span><small>{item.height} см</small></button>)}</div>
  </div>
}

function EngineeringInspector({ item, layer, onChange, onDelete }) {
  const spec = ENGINEERING_ITEMS[item.type] || { label: item.type }
  return <div className="planner-inspector__content">
    <div className="engineering-inspector-title"><span>{ENGINEERING_LAYERS[layer]?.short}</span><div><small>Инженерная точка</small><strong>{spec.label}</strong></div></div>
    <div className="planner-fields">
      <NumberInput label="X" value={item.x} unit="см" onChange={(x) => onChange({ x })} />
      <NumberInput label="Y" value={item.y} unit="см" onChange={(y) => onChange({ y })} />
      <NumberInput label="Высота" value={item.height} unit="см" min={0} max={1000} onChange={(height) => onChange({ height })} />
    </div>
    <TextInput label="Примечание" value={item.note || ''} onChange={(note) => onChange({ note })} />
    <div className="planner-danger-actions"><button type="button" onClick={onDelete}>Удалить точку</button></div>
  </div>
}

function ValidationView({ project }) {
  const issues = useMemo(() => validateProject(project), [project])
  const errors = issues.filter((item) => item.severity === 'error').length
  const warnings = issues.filter((item) => item.severity === 'warn').length
  return <div className="planner-validation">
    <div className="validation-summary"><div><small>Ошибки</small><strong>{errors}</strong></div><div><small>Предупреждения</small><strong>{warnings}</strong></div><p>Проверка ловит геометрические конфликты и пропущенные инженерные опорные точки. Нормативные решения всё равно нужно сверять с проектом и требованиями конкретной системы.</p></div>
    <div className="validation-list">{issues.map((item) => <div key={item.id} className={'validation-item ' + item.severity}><span>{item.severity === 'error' ? '×' : item.severity === 'warn' ? '!' : item.severity === 'ok' ? '✓' : 'i'}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div></div>)}</div>
  </div>
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
  const [layer, setLayer] = useState('architecture')
  const [tool, setTool] = useState('select')
  const [engineeringType, setEngineeringType] = useState('socket')
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
  const selectedEngineering = selected.type === 'engineering' ? project.engineering?.[selected.layer]?.find((item) => item.id === selected.id) : null
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
  const addFreeWall = (coords = null) => {
    const wall = { ...makeFreeWall(project.freeWalls.length), ...(coords || {}) }
    commit((current) => ({ ...current, freeWalls: [...current.freeWalls, wall] }))
    setSelected({ type: 'wall', id: wall.id })
    setTab('plan')
  }
  const addEngineeringPoint = (layerKey, type, point) => {
    const spec = ENGINEERING_ITEMS[type]
    if (!spec || spec.layer !== layerKey) return
    const item = { id: uid('eng'), type, x: round(point.x, 1), y: round(point.y, 1), height: spec.height, note: '' }
    commit((current) => {
      const engineering = normalizeEngineering(current.engineering)
      return {
        ...current,
        engineering: {
          ...engineering,
          [layerKey]: [...engineering[layerKey], item],
        },
      }
    })
    setSelected({ type: 'engineering', layer: layerKey, id: item.id })
  }
  const updateEngineeringPoint = (patch) => {
    if (!selectedEngineering) return
    commit((current) => ({
      ...current,
      engineering: {
        ...current.engineering,
        [selected.layer]: current.engineering[selected.layer].map((item) => item.id === selectedEngineering.id ? { ...item, ...patch } : item),
      },
    }))
  }
  const deleteEngineeringPoint = () => {
    if (!selectedEngineering) return
    commit((current) => ({
      ...current,
      engineering: {
        ...current.engineering,
        [selected.layer]: current.engineering[selected.layer].filter((item) => item.id !== selectedEngineering.id),
      },
    }))
    setSelected({ type: 'none', id: '' })
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

  const resizeRoom = (id, width, depth, done) => {
    if (!done) {
      if (!dragSnapshot.current) dragSnapshot.current = project
      setProject((current) => ({ ...current, rooms: current.rooms.map((room) => room.id === id ? { ...room, width: clamp(width, 50, 5000), depth: clamp(depth, 50, 5000) } : room) }))
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
      <button type="button" className={tab === 'validation' ? 'active' : ''} onClick={() => setTab('validation')}>Проверка проекта</button>
      <div className="planner-tabs__summary"><span>{project.rooms.length} помещений</span><b>{metrics.floorArea.toFixed(1)} м²</b></div>
    </div>

    {tab === 'plan' && <div className="planner-workspace">
      <aside className="planner-objects">
        {layer === 'architecture' ? <>
          <div className="planner-panel-head"><div><span>ОБЪЕКТЫ</span><strong>Помещения и стены</strong></div><button type="button" onClick={addRoom}>+ Комната</button></div>
          <div className="planner-object-list">
            {project.rooms.map((room) => <button type="button" key={room.id} className={selected.type === 'room' && selected.id === room.id ? 'active' : ''} onClick={() => { setTool('select'); setSelected({ type: 'room', id: room.id, side: 'north' }) }}><span className="object-index">{String(project.rooms.indexOf(room) + 1).padStart(2, '0')}</span><div><strong>{room.name}</strong><small>{room.width} × {room.depth} см · {(room.width * room.depth / 10000).toFixed(1)} м²</small></div></button>)}
          </div>
          <div className="planner-draw-actions">
            <button className={tool === 'wall' ? 'active' : ''} type="button" onClick={() => { setTool(tool === 'wall' ? 'select' : 'wall'); setView('2d') }}>{tool === 'wall' ? '✓ Закончить стены' : '✎ Рисовать стены'}</button>
            <button type="button" onClick={() => addFreeWall()}>+ Стена по координатам</button>
          </div>
          {tool === 'wall' && <div className="planner-tool-help"><b>Режим построения</b><span>Кликайте последовательные точки. Есть привязка к углам, серединам, сетке и углам 0/45/90°. Esc сбрасывает текущую цепочку.</span></div>}
          {project.freeWalls.length > 0 && <div className="planner-object-list planner-object-list--walls">{project.freeWalls.map((wall) => <button type="button" key={wall.id} className={selected.type === 'wall' && selected.id === wall.id ? 'active' : ''} onClick={() => { setTool('select'); setSelected({ type: 'wall', id: wall.id }) }}><span className="object-index">W</span><div><strong>{wall.name}</strong><small>{(wallLengthFree(wall) / 100).toFixed(2)} м · {wall.height} см</small></div></button>)}</div>}
          <div className="planner-grid-control"><span>Привязка к сетке</span><select value={project.grid} onChange={(e) => commit((current) => ({ ...current, grid: Number(e.target.value) }))}><option value="10">10 см</option><option value="20">20 см</option><option value="50">50 см</option></select></div>
          <button className="planner-reset" type="button" onClick={resetProject}>Загрузить пример заново</button>
        </> : <EngineeringPalette layer={layer} activeType={tool === 'engineering' ? engineeringType : ''} onChoose={(type) => { setEngineeringType(type); setTool('engineering'); setView('2d') }} onSelectMode={() => setTool('select')} />}
      </aside>

      <section className="planner-stage">
        <div className="planner-layerbar">{Object.entries(ENGINEERING_LAYERS).map(([key, item]) => <button key={key} type="button" className={layer === key ? 'active' : ''} onClick={() => { setLayer(key); setTool('select'); if (key === 'architecture') setSelected({ type: 'room', id: project.rooms[0]?.id || '', side: 'north' }); else { setView('2d'); setSelected({ type: 'none', id: '' }) } }}><b>{item.short}</b><span>{item.label}</span></button>)}</div>
        <div className="planner-stage-toolbar">
          <div className="view-switch"><button type="button" className={view === '2d' ? 'active' : ''} onClick={() => setView('2d')}>2D план</button><button type="button" className={view === '3d' ? 'active' : ''} onClick={() => setView('3d')}>3D вид</button></div>
          {view === '3d' && <div className="angle-control"><button type="button" onClick={() => setAngle((a) => a - 15)}>↶</button><span>{angle}°</span><button type="button" onClick={() => setAngle((a) => a + 15)}>↷</button></div>}
          <div className="stage-hint">{view === '2d' ? 'Перетаскивайте помещения; круглый маркер меняет размер. План автоматически вписывается в рабочую область.' : 'Вращайте модель мышью или пальцем; клик по стене или полу открывает параметры.'}</div>
        </div>
        <div className="planner-canvas">
          {view === '2d' ? <FloorPlan2D project={project} selected={selected} setSelected={setSelected} onDragRoom={dragRoom} onResizeRoom={resizeRoom} tool={tool} layer={layer} engineeringType={engineeringType} onAddFreeWall={addFreeWall} onAddEngineering={addEngineeringPoint} /> : <FloorPlan3D project={project} selected={selected} setSelected={setSelected} angle={angle} />}
        </div>
        <div className="planner-scale"><i /><span>100 см</span></div>
      </section>

      <aside className="planner-inspector">
        <div className="planner-panel-head"><div><span>ПАРАМЕТРЫ</span><strong>{selectedRoom ? selectedRoom.name : selectedWall ? selectedWall.name : selectedEngineering ? (ENGINEERING_ITEMS[selectedEngineering.type]?.label || 'Инженерная точка') : 'Выберите объект'}</strong></div></div>
        {selectedRoom && <RoomInspector room={selectedRoom} side={selected.side || 'north'} onRoomChange={updateRoom} onWallChange={updateRoomWall} onDelete={deleteSelectedRoom} onDuplicate={duplicateRoom} />}
        {selectedWall && <FreeWallInspector wall={selectedWall} onChange={updateFreeWall} onDelete={deleteSelectedWall} />}
        {selectedEngineering && <EngineeringInspector item={selectedEngineering} layer={selected.layer} onChange={updateEngineeringPoint} onDelete={deleteEngineeringPoint} />}
      </aside>
    </div>}

    {tab === 'materials' && <MaterialsView project={project} onPriceChange={(key, value) => commit((current) => ({ ...current, prices: { ...(current.prices || {}), [key]: value === '' ? '' : Math.max(0, Number(value) || 0) } }))} />}
    {tab === 'readiness' && <ReadinessView project={project} />}
    {tab === 'validation' && <ValidationView project={project} />}

    {notice && <div className="planner-toast" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')}>×</button></div>}
  </main>
}
