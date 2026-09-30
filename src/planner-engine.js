const SIDES = ['north', 'east', 'south', 'west']

export const ENGINEERING_LAYERS = {
  architecture: { label: 'Архитектура', short: 'АРХ' },
  electrical: { label: 'Электрика', short: 'ЭЛ' },
  plumbing: { label: 'Вода / канализация', short: 'ВК' },
  heating: { label: 'Отопление', short: 'ОВ' },
}

export const ENGINEERING_ITEMS = {
  socket: { layer: 'electrical', label: 'Розетка', glyph: 'Р', height: 30 },
  switch: { layer: 'electrical', label: 'Выключатель', glyph: 'В', height: 90 },
  light: { layer: 'electrical', label: 'Светильник', glyph: 'С', height: 250 },
  junction: { layer: 'electrical', label: 'Распредкоробка', glyph: 'К', height: 220 },
  water: { layer: 'plumbing', label: 'Водорозетка', glyph: 'В', height: 60 },
  drain: { layer: 'plumbing', label: 'Канализация', glyph: 'К', height: 20 },
  riser: { layer: 'plumbing', label: 'Стояк', glyph: 'СТ', height: 0 },
  radiator: { layer: 'heating', label: 'Радиатор', glyph: 'РД', height: 15 },
  manifold: { layer: 'heating', label: 'Коллектор', glyph: 'КЛ', height: 50 },
}

export const WALL_ASSEMBLIES = {
  'drywall-50-single': { label: 'ГКЛ 1+1 · профиль 50', thickness: 75, layersPerSide: 1, stud: 50, insulation: 50, board: 'ГКЛ 12,5 мм' },
  'drywall-75-single': { label: 'ГКЛ 1+1 · профиль 75', thickness: 100, layersPerSide: 1, stud: 75, insulation: 75, board: 'ГКЛ 12,5 мм' },
  'drywall-75-double': { label: 'ГКЛ 2+2 · профиль 75', thickness: 125, layersPerSide: 2, stud: 75, insulation: 75, board: 'ГКЛ 12,5 мм' },
  'drywall-100-double': { label: 'ГКЛ 2+2 · профиль 100', thickness: 150, layersPerSide: 2, stud: 100, insulation: 100, board: 'ГКЛ 12,5 мм' },
  'drywall-moisture-75-double': { label: 'ГКЛВ 2+2 · профиль 75', thickness: 125, layersPerSide: 2, stud: 75, insulation: 75, board: 'ГКЛВ 12,5 мм' },
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0))
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const gridSnap = (value, grid) => Math.round(value / grid) * grid

function roomGuidePoints(room) {
  const x1 = room.x
  const y1 = room.y
  const x2 = room.x + room.width
  const y2 = room.y + room.depth
  return [
    { x: x1, y: y1, label: 'угол' }, { x: x2, y: y1, label: 'угол' },
    { x: x2, y: y2, label: 'угол' }, { x: x1, y: y2, label: 'угол' },
    { x: (x1 + x2) / 2, y: y1, label: 'середина' },
    { x: x2, y: (y1 + y2) / 2, label: 'середина' },
    { x: (x1 + x2) / 2, y: y2, label: 'середина' },
    { x: x1, y: (y1 + y2) / 2, label: 'середина' },
  ]
}

export function snapProjectPoint(project, raw, origin = null, threshold = 24) {
  const grid = Number(project.grid) || 20
  let best = { x: gridSnap(raw.x, grid), y: gridSnap(raw.y, grid), kind: 'grid', label: `сетка ${grid} см` }
  let bestDistance = dist(raw, best)
  const guides = []
  ;(project.rooms || []).forEach((room) => guides.push(...roomGuidePoints(room)))
  ;(project.freeWalls || []).forEach((wall) => {
    guides.push(
      { x: wall.x1, y: wall.y1, label: 'конец стены' },
      { x: wall.x2, y: wall.y2, label: 'конец стены' },
      { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2, label: 'середина стены' },
    )
  })
  guides.forEach((guide) => {
    const d = dist(raw, guide)
    if (d <= threshold && d < bestDistance + 5) {
      best = { ...guide, kind: 'geometry' }
      bestDistance = d
    }
  })
  if (origin && best.kind !== 'geometry') {
    const dx = raw.x - origin.x
    const dy = raw.y - origin.y
    const length = Math.hypot(dx, dy)
    if (length > 1) {
      const angle = Math.atan2(dy, dx)
      const step = Math.PI / 4
      const snappedAngle = Math.round(angle / step) * step
      const delta = Math.abs(Math.atan2(Math.sin(angle - snappedAngle), Math.cos(angle - snappedAngle)))
      if (delta <= Math.PI / 30) {
        const anglePoint = { x: origin.x + Math.cos(snappedAngle) * length, y: origin.y + Math.sin(snappedAngle) * length }
        best = {
          x: gridSnap(anglePoint.x, grid),
          y: gridSnap(anglePoint.y, grid),
          kind: 'angle',
          label: `${Math.round(snappedAngle * 180 / Math.PI)}°`,
        }
      }
    }
  }
  return best
}

export function normalizeEngineering(input) {
  const result = { electrical: [], plumbing: [], heating: [] }
  Object.keys(result).forEach((layer) => {
    const source = input && Array.isArray(input[layer]) ? input[layer] : []
    result[layer] = source.slice(0, 500).map((item) => {
      const spec = ENGINEERING_ITEMS[item.type]
      const type = spec && spec.layer === layer ? item.type : Object.keys(ENGINEERING_ITEMS).find((key) => ENGINEERING_ITEMS[key].layer === layer)
      return {
        id: item.id || `${layer}-${Math.random().toString(36).slice(2, 9)}`,
        type,
        x: clamp(item.x, 0, 5000),
        y: clamp(item.y, 0, 5000),
        height: clamp(item.height ?? ENGINEERING_ITEMS[type]?.height ?? 30, 0, 1000),
        note: String(item.note || '').slice(0, 120),
      }
    }).filter((item) => item.type)
  })
  return result
}

export function engineeringItemsForLayer(layer) {
  return Object.entries(ENGINEERING_ITEMS).filter(([, item]) => item.layer === layer)
}

function wallCoords(room, side) {
  if (side === 'north') return [room.x, room.y, room.x + room.width, room.y]
  if (side === 'south') return [room.x, room.y + room.depth, room.x + room.width, room.y + room.depth]
  if (side === 'west') return [room.x, room.y, room.x, room.y + room.depth]
  return [room.x + room.width, room.y, room.x + room.width, room.y + room.depth]
}

function openingArea(opening) {
  return (Number(opening.width) || 0) * (Number(opening.height) || 0) / 10000
}

function segmentKey(coords) {
  const a = `${coords[0]},${coords[1]}`
  const b = `${coords[2]},${coords[3]}`
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function buildDrywallTakeoff(project) {
  const rows = []
  const seen = new Set()
  const totals = { regularBoardArea: 0, moistureBoardArea: 0, trackByStud: {}, studByStud: {}, insulationByDepth: {}, screw25: 0, screw35: 0 }
  const consume = (coords, wall, heightCm) => {
    if (!wall || wall.material !== 'drywall') return
    const key = segmentKey(coords)
    if (seen.has(key)) return
    seen.add(key)
    const assembly = WALL_ASSEMBLIES[wall.assembly] || WALL_ASSEMBLIES['drywall-75-single']
    const lengthM = Math.hypot(coords[2] - coords[0], coords[3] - coords[1]) / 100
    const grossArea = lengthM * heightCm / 100
    const openArea = (wall.openings || []).reduce((sum, item) => sum + openingArea(item), 0)
    const netArea = Math.max(0, grossArea - openArea)
    const boardArea = netArea * 2 * assembly.layersPerSide * 1.1
    if (assembly.board.startsWith('ГКЛВ')) totals.moistureBoardArea += boardArea
    else totals.regularBoardArea += boardArea
    totals.trackByStud[assembly.stud] = (totals.trackByStud[assembly.stud] || 0) + lengthM * 2 * 1.08
    const studCount = Math.max(2, Math.ceil(lengthM / 0.6) + 1)
    totals.studByStud[assembly.stud] = (totals.studByStud[assembly.stud] || 0) + studCount * heightCm / 100 * 1.08
    if (assembly.insulation) totals.insulationByDepth[assembly.insulation] = (totals.insulationByDepth[assembly.insulation] || 0) + netArea * 1.05
    totals.screw25 += netArea * 2 * Math.min(1, assembly.layersPerSide) * 18
    if (assembly.layersPerSide > 1) totals.screw35 += netArea * 2 * (assembly.layersPerSide - 1) * 18
  }
  ;(project.rooms || []).forEach((room) => SIDES.forEach((side) => consume(wallCoords(room, side), room.walls?.[side], room.height)))
  ;(project.freeWalls || []).forEach((wall) => consume([wall.x1, wall.y1, wall.x2, wall.y2], wall, wall.height))

  const add = (group, name, qty, unit, reserve, note) => {
    if (qty > 0) rows.push({ group, name, qty: unit === 'шт' ? Math.ceil(qty) : Number(qty.toFixed(1)), unit, reserve, note })
  }
  add('Стены · ГКЛ', 'ГКЛ 1200×2500×12,5', totals.regularBoardArea / 3, 'шт', '10%', 'По выбранным пирогам, обе стороны перегородок')
  add('Стены · ГКЛ', 'ГКЛВ 1200×2500×12,5', totals.moistureBoardArea / 3, 'шт', '10%', 'Влагостойкие листы по выбранным пирогам')
  Object.entries(totals.trackByStud).forEach(([stud, meters]) => add('Стены · ГКЛ', `ПН ${stud} мм`, meters, 'м', '8%', 'Направляющий профиль: пол + потолок'))
  Object.entries(totals.studByStud).forEach(([stud, meters]) => add('Стены · ГКЛ', `ПС ${stud} мм`, meters, 'м', '8%', 'Стойки с базовым шагом около 600 мм'))
  Object.entries(totals.insulationByDepth).forEach(([depth, area]) => add('Стены · ГКЛ', `Минеральная вата ${depth} мм`, area, 'м²', '5%', 'Заполнение каркаса по выбранному пирогу'))
  add('Стены · ГКЛ', 'Саморезы TN25', totals.screw25, 'шт', '10%', 'Ориентир для первого слоя обшивки')
  add('Стены · ГКЛ', 'Саморезы TN35', totals.screw35, 'шт', '10%', 'Ориентир для второго слоя обшивки')
  return rows
}

export function buildEngineeringTakeoff(project) {
  const rows = []
  const engineering = normalizeEngineering(project.engineering)
  const count = (layer, type) => engineering[layer].filter((item) => item.type === type).length
  const sockets = count('electrical', 'socket')
  const switches = count('electrical', 'switch')
  const lights = count('electrical', 'light')
  const junctions = count('electrical', 'junction')
  const waters = count('plumbing', 'water')
  const drains = count('plumbing', 'drain')
  const risers = count('plumbing', 'riser')
  const radiators = count('heating', 'radiator')
  const manifolds = count('heating', 'manifold')
  const add = (group, name, qty, note) => {
    if (qty > 0) rows.push({ group, name, qty, unit: 'шт', reserve: '0%', note })
  }
  add('Электрика · точки', 'Розетка', sockets, 'Количество точек из плана')
  add('Электрика · точки', 'Выключатель', switches, 'Количество точек из плана')
  add('Электрика · точки', 'Световая точка', lights, 'Количество точек из плана')
  add('Электрика · точки', 'Распределительная коробка', junctions, 'Количество точек из плана')
  add('Электрика · монтаж', 'Подрозетник Ø68', sockets + switches, 'Минимум по нанесённым розеткам и выключателям')
  add('Сантехника · точки', 'Водорозетка', waters, 'Количество точек ХВС/ГВС уточняется по оборудованию')
  add('Сантехника · точки', 'Канализационная точка', drains, 'Диаметр и уклоны уточняются отдельно')
  add('Сантехника · точки', 'Стояк', risers, 'Опорные точки инженерной схемы')
  add('Отопление · точки', 'Радиатор', radiators, 'Количество приборов на плане')
  add('Отопление · точки', 'Коллектор', manifolds, 'Количество коллекторных узлов')
  return rows
}

function roomOverlap(a, b) {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const y = Math.max(0, Math.min(a.y + a.depth, b.y + b.depth) - Math.max(a.y, b.y))
  return x * y
}

export function validateProject(project) {
  const issues = []
  const push = (severity, title, detail) => issues.push({ id: `${severity}-${issues.length}`, severity, title, detail })
  ;(project.rooms || []).forEach((room) => {
    if (room.width < 50 || room.depth < 50) push('error', `${room.name}: неверная геометрия`, 'Размер помещения меньше допустимого.')
    SIDES.forEach((side) => {
      const wall = room.walls?.[side]
      if (!wall) return
      const wallLength = side === 'north' || side === 'south' ? room.width : room.depth
      ;(wall.openings || []).forEach((opening) => {
        if (opening.offset + opening.width > wallLength + 0.5) push('error', `${room.name}: проём выходит за стену`, `${side}: ${opening.offset + opening.width} см при длине стены ${wallLength} см.`)
        if (opening.type === 'window' && opening.sill + opening.height > room.height + 0.5) push('error', `${room.name}: окно выше потолка`, 'Подоконник + высота окна превышают высоту помещения.')
        if (opening.type === 'door' && opening.height > room.height + 0.5) push('error', `${room.name}: дверь выше потолка`, 'Высота двери превышает высоту помещения.')
      })
    })
  })
  for (let i = 0; i < (project.rooms || []).length; i += 1) {
    for (let j = i + 1; j < project.rooms.length; j += 1) {
      const area = roomOverlap(project.rooms[i], project.rooms[j])
      if (area > 100) push('warn', 'Помещения перекрываются', `${project.rooms[i].name} и ${project.rooms[j].name}: пересечение ${(area / 10000).toFixed(2)} м².`)
    }
  }
  ;(project.freeWalls || []).forEach((wall) => {
    const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
    if (len < 20) push('error', `${wall.name}: слишком короткая стена`, `Длина ${len.toFixed(1)} см.`)
    ;(wall.openings || []).forEach((opening) => {
      if (opening.offset + opening.width > len + 0.5) push('error', `${wall.name}: проём выходит за стену`, 'Проверьте ширину и отступ проёма.')
    })
  })
  const engineering = normalizeEngineering(project.engineering)
  if (engineering.plumbing.some((item) => item.type === 'drain') && !engineering.plumbing.some((item) => item.type === 'riser')) {
    push('warn', 'Есть канализация, но не указан стояк', 'Добавьте стояк как опорную точку перед прокладкой трасс.')
  }
  if (engineering.electrical.length && !engineering.electrical.some((item) => item.type === 'junction')) {
    push('info', 'Электроточки нанесены без распредкоробок', 'Это допустимо для шлейфовых схем, но способ соединений стоит зафиксировать до монтажа.')
  }
  if (!issues.length) push('ok', 'Критичных геометрических ошибок не найдено', 'План прошёл базовую автоматическую проверку.')
  return issues
}
