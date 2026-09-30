export const WALL_PHASES = {
  existing: 'Существующая',
  new: 'Новая',
  demolish: 'Демонтаж',
}

export const ROUTE_TYPES = {
  'power-25': { layer: 'electrical', label: 'Розеточная линия 3×2,5', glyph: '3×2,5', product: 'Кабель ВВГнг-LS 3×2,5', reserve: .12, group: 'Электрика · кабель', defaultHeight: 30 },
  'light-15': { layer: 'electrical', label: 'Освещение 3×1,5', glyph: '3×1,5', product: 'Кабель ВВГнг-LS 3×1,5', reserve: .12, group: 'Электрика · кабель', defaultHeight: 230 },
  'low-voltage': { layer: 'electrical', label: 'Слаботочная трасса', glyph: 'LAN', product: 'Кабель UTP Cat.6', reserve: .12, group: 'Электрика · слаботочка', defaultHeight: 30 },
  'water-cold': { layer: 'plumbing', label: 'ХВС Ø16', glyph: 'ХВС', product: 'Труба водоснабжения Ø16', reserve: .10, group: 'Сантехника · трубы', defaultHeight: 30 },
  'water-hot': { layer: 'plumbing', label: 'ГВС Ø16', glyph: 'ГВС', product: 'Труба водоснабжения Ø16', reserve: .10, group: 'Сантехника · трубы', defaultHeight: 30 },
  'drain-50': { layer: 'plumbing', label: 'Канализация Ø50', glyph: 'Ø50', product: 'Труба канализационная Ø50', reserve: .08, group: 'Сантехника · канализация', defaultHeight: 18, slope: 3 },
  'drain-110': { layer: 'plumbing', label: 'Канализация Ø110', glyph: 'Ø110', product: 'Труба канализационная Ø110', reserve: .08, group: 'Сантехника · канализация', defaultHeight: 12, slope: 2 },
  'heating-16': { layer: 'heating', label: 'Отопление Ø16', glyph: 'ОВ', product: 'Труба отопления Ø16', reserve: .10, group: 'Отопление · трубы', defaultHeight: 15 },
}

export const FLOOR_LAYOUT_DEFAULTS = {
  tile: { width: 60, height: 60, joint: .2, packageArea: 1.44, direction: 0, centered: true },
  laminate: { width: 19.3, height: 138, joint: 0, packageArea: 2.2, direction: 0, centered: false },
  vinyl: { width: 18, height: 122, joint: 0, packageArea: 2.2, direction: 0, centered: false },
  parquet: { width: 18, height: 180, joint: 0, packageArea: 2.0, direction: 0, centered: false },
}

export const TILE_LAYOUT_DEFAULT = { width: 60, height: 60, joint: .2, packageArea: 1.44, centered: true }

const round = (value, digits = 2) => Number((Number(value) || 0).toFixed(digits))
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0))
const uid = (prefix = 'id') => prefix + '-' + Math.random().toString(36).slice(2, 10)

export function wallVisibleForPhase(wall, mode = 'proposed') {
  const phase = wall?.phase || 'existing'
  if (mode === 'all') return true
  if (mode === 'existing') return phase === 'existing' || phase === 'demolish'
  return phase === 'existing' || phase === 'new'
}

export function normalizeUnderlay(raw) {
  if (!raw || typeof raw !== 'object') return null
  const dataUrl = typeof raw.dataUrl === 'string' && raw.dataUrl.startsWith('data:image/') ? raw.dataUrl : ''
  if (!dataUrl) return null
  return {
    dataUrl,
    x: clamp(raw.x, -5000, 5000),
    y: clamp(raw.y, -5000, 5000),
    width: clamp(raw.width || 1200, 50, 10000),
    height: clamp(raw.height || 800, 50, 10000),
    opacity: clamp(raw.opacity ?? .42, .05, 1),
    referenceCm: clamp(raw.referenceCm || 100, 1, 10000),
    name: String(raw.name || 'Подложка').slice(0, 80),
  }
}

export function calibrateUnderlay(underlay, pointA, pointB, realCm) {
  if (!underlay || !pointA || !pointB) return underlay
  const measured = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y)
  const target = Number(realCm)
  if (!(measured > 1) || !(target > 0)) return underlay
  const factor = target / measured
  return {
    ...underlay,
    x: pointA.x - (pointA.x - underlay.x) * factor,
    y: pointA.y - (pointA.y - underlay.y) * factor,
    width: underlay.width * factor,
    height: underlay.height * factor,
  }
}

export function normalizeRoutes(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 400).map((route) => {
    const type = ROUTE_TYPES[route.type] ? route.type : 'power-25'
    const spec = ROUTE_TYPES[type]
    const points = Array.isArray(route.points) ? route.points.slice(0, 120).map((p) => ({
      x: clamp(p.x, -5000, 10000),
      y: clamp(p.y, -5000, 10000),
    })) : []
    return {
      id: route.id || uid('route'),
      name: String(route.name || spec.label).slice(0, 80),
      type,
      layer: spec.layer,
      points,
      startHeight: clamp(route.startHeight ?? spec.defaultHeight, 0, 1000),
      endHeight: clamp(route.endHeight ?? spec.defaultHeight, 0, 1000),
      slope: clamp(route.slope ?? spec.slope ?? 0, 0, 20),
      note: String(route.note || '').slice(0, 160),
    }
  }).filter((route) => route.points.length >= 2)
}

export function routeLengthCm(route, includeVertical = true) {
  const points = route?.points || []
  let length = 0
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  if (includeVertical) length += Math.abs((route?.startHeight || 0) - (route?.endHeight || 0))
  return length
}

export function routeActualSlope(route) {
  const horizontal = routeLengthCm(route, false)
  if (!horizontal) return 0
  return ((Number(route.startHeight) || 0) - (Number(route.endHeight) || 0)) / horizontal * 100
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function segmentIntersection(a, b, c, d) {
  const r = { x: b.x - a.x, y: b.y - a.y }
  const s = { x: d.x - c.x, y: d.y - c.y }
  const den = r.x * s.y - r.y * s.x
  if (Math.abs(den) < 1e-8) return null
  const qmp = { x: c.x - a.x, y: c.y - a.y }
  const t = (qmp.x * s.y - qmp.y * s.x) / den
  const u = (qmp.x * r.y - qmp.y * r.x) / den
  if (t < -1e-7 || t > 1 + 1e-7 || u < -1e-7 || u > 1 + 1e-7) return null
  return { x: a.x + t * r.x, y: a.y + t * r.y, t, u }
}

function pointKey(point, tolerance) {
  const step = Math.max(.2, tolerance || 1)
  return Math.round(point.x / step) + ':' + Math.round(point.y / step)
}

function polygonArea(points) {
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

function polygonCentroid(points, signedArea) {
  let cx = 0
  let cy = 0
  let factorSum = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const factor = a.x * b.y - b.x * a.y
    cx += (a.x + b.x) * factor
    cy += (a.y + b.y) * factor
    factorSum += factor
  }
  if (Math.abs(factorSum) < 1e-8) {
    return {
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length,
    }
  }
  return { x: cx / (3 * factorSum), y: cy / (3 * factorSum) }
}

function polygonPerimeter(points) {
  let total = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    total += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return total
}

function faceSignature(sourceIds, centroid) {
  const ids = [...new Set(sourceIds)].sort()
  return ids.join('|') + '@' + Math.round(centroid.x / 5) + ':' + Math.round(centroid.y / 5)
}

export function buildTopologyRooms(freeWalls, mode = 'proposed', tolerance = 1) {
  const source = (Array.isArray(freeWalls) ? freeWalls : [])
    .filter((wall) => wallVisibleForPhase(wall, mode))
    .map((wall) => ({
      id: wall.id,
      a: { x: Number(wall.x1) || 0, y: Number(wall.y1) || 0 },
      b: { x: Number(wall.x2) || 0, y: Number(wall.y2) || 0 },
    }))
    .filter((seg) => Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) > 1)

  const splitTs = source.map(() => [0, 1])
  for (let i = 0; i < source.length; i += 1) {
    for (let j = i + 1; j < source.length; j += 1) {
      const hit = segmentIntersection(source[i].a, source[i].b, source[j].a, source[j].b)
      if (!hit) continue
      if (hit.t > 1e-6 && hit.t < 1 - 1e-6) splitTs[i].push(hit.t)
      if (hit.u > 1e-6 && hit.u < 1 - 1e-6) splitTs[j].push(hit.u)
    }
  }

  const nodes = new Map()
  const edges = []
  const edgeKeys = new Set()
  const getNode = (point) => {
    const key = pointKey(point, tolerance)
    if (!nodes.has(key)) nodes.set(key, { id: key, x: point.x, y: point.y, links: [] })
    return nodes.get(key)
  }

  source.forEach((seg, index) => {
    const ts = [...new Set(splitTs[index].map((t) => round(t, 8)))].sort((a, b) => a - b)
    for (let k = 1; k < ts.length; k += 1) {
      const t1 = ts[k - 1]
      const t2 = ts[k]
      if (t2 - t1 < 1e-7) continue
      const a = {
        x: seg.a.x + (seg.b.x - seg.a.x) * t1,
        y: seg.a.y + (seg.b.y - seg.a.y) * t1,
      }
      const b = {
        x: seg.a.x + (seg.b.x - seg.a.x) * t2,
        y: seg.a.y + (seg.b.y - seg.a.y) * t2,
      }
      const na = getNode(a)
      const nb = getNode(b)
      if (na.id === nb.id) continue
      const key = na.id < nb.id ? na.id + '|' + nb.id : nb.id + '|' + na.id
      if (edgeKeys.has(key)) continue
      edgeKeys.add(key)
      const edge = { id: key, a: na.id, b: nb.id, sourceId: seg.id }
      edges.push(edge)
      na.links.push({ node: nb.id, edge })
      nb.links.push({ node: na.id, edge })
    }
  })

  nodes.forEach((node) => {
    node.links.sort((l1, l2) => {
      const a = nodes.get(l1.node)
      const b = nodes.get(l2.node)
      return Math.atan2(a.y - node.y, a.x - node.x) - Math.atan2(b.y - node.y, b.x - node.x)
    })
  })

  const visited = new Set()
  const rooms = []
  const maxSteps = edges.length * 4 + 20

  for (const edge of edges) {
    for (const start of [[edge.a, edge.b], [edge.b, edge.a]]) {
      const startKey = start[0] + '>' + start[1]
      if (visited.has(startKey)) continue
      const points = []
      const sourceIds = []
      let from = start[0]
      let to = start[1]
      let closed = false

      for (let step = 0; step < maxSteps; step += 1) {
        const directedKey = from + '>' + to
        if (visited.has(directedKey) && step > 0) break
        visited.add(directedKey)
        const fromNode = nodes.get(from)
        const toNode = nodes.get(to)
        if (!fromNode || !toNode) break
        points.push({ x: fromNode.x, y: fromNode.y })

        const currentEdge = edges.find((e) => (e.a === from && e.b === to) || (e.a === to && e.b === from))
        if (currentEdge) sourceIds.push(currentEdge.sourceId)

        const reverseIndex = toNode.links.findIndex((link) => link.node === from)
        if (reverseIndex < 0 || toNode.links.length < 2) break
        const nextIndex = (reverseIndex - 1 + toNode.links.length) % toNode.links.length
        const next = toNode.links[nextIndex].node
        from = to
        to = next
        if (from === start[0] && to === start[1]) {
          closed = true
          break
        }
      }

      if (!closed || points.length < 3) continue
      const signedArea = polygonArea(points)
      if (signedArea <= 100) continue
      const centroid = polygonCentroid(points, signedArea)
      const signature = faceSignature(sourceIds, centroid)
      if (rooms.some((room) => room.signature === signature)) continue
      rooms.push({
        id: 'topo-' + signature,
        signature,
        points,
        area: signedArea / 10000,
        perimeter: polygonPerimeter(points) / 100,
        centroid,
        sourceWallIds: [...new Set(sourceIds)],
      })
    }
  }

  return rooms.sort((a, b) => b.area - a.area)
}

export function normalizeTopologyMeta(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  Object.entries(raw).slice(0, 120).forEach(([key, value]) => {
    out[key] = {
      name: String(value?.name || 'Помещение').slice(0, 60),
      floorFinish: ['laminate', 'tile', 'vinyl', 'parquet', 'screed'].includes(value?.floorFinish) ? value.floorFinish : 'laminate',
      ceilingFinish: ['paint', 'stretch', 'drywall', 'none'].includes(value?.ceilingFinish) ? value.ceilingFinish : 'paint',
      height: clamp(value?.height || 270, 180, 1000),
    }
  })
  return out
}

export function topologyMetaFor(project, room, index = 0) {
  const meta = project?.topologyMeta?.[room.signature]
  return meta || {
    name: 'Автопомещение ' + (index + 1),
    floorFinish: 'laminate',
    ceilingFinish: 'paint',
    height: 270,
  }
}

export function analyzeSurfaceLayout(widthCm, heightCm, settings = TILE_LAYOUT_DEFAULT) {
  const width = Math.max(1, Number(widthCm) || 1)
  const height = Math.max(1, Number(heightCm) || 1)
  const tileW = Math.max(1, Number(settings.width) || 60)
  const tileH = Math.max(1, Number(settings.height) || 60)
  const joint = Math.max(0, Number(settings.joint) || 0)
  const pitchX = tileW + joint
  const pitchY = tileH + joint
  const fullCols = Math.floor((width + joint) / pitchX)
  const fullRows = Math.floor((height + joint) / pitchY)
  const usedW = fullCols ? fullCols * tileW + Math.max(0, fullCols - 1) * joint : 0
  const usedH = fullRows ? fullRows * tileH + Math.max(0, fullRows - 1) * joint : 0
  const restW = Math.max(0, width - usedW - (fullCols ? joint : 0))
  const restH = Math.max(0, height - usedH - (fullRows ? joint : 0))
  const cutW = settings.centered ? restW / 2 : restW
  const cutH = settings.centered ? restH / 2 : restH
  const minCutRatio = Math.min(
    cutW > .01 ? cutW / tileW : 1,
    cutH > .01 ? cutH / tileH : 1
  )
  const totalArea = width * height / 10000
  const pieceArea = tileW * tileH / 10000
  const theoreticalPieces = Math.ceil(totalArea / pieceArea * 1.1)
  const packageArea = Math.max(.01, Number(settings.packageArea) || 1.44)
  const boxes = Math.ceil(totalArea * 1.1 / packageArea)
  return {
    width,
    height,
    tileW,
    tileH,
    joint,
    fullCols,
    fullRows,
    cutW: round(cutW, 1),
    cutH: round(cutH, 1),
    minCutRatio: round(minCutRatio, 3),
    totalArea: round(totalArea, 2),
    pieces: theoreticalPieces,
    boxes,
    warning: minCutRatio < .25 ? 'Узкая подрезка меньше 25% формата' : '',
  }
}

export function analyzeRoomFloorLayout(room) {
  if (!room) return null
  const defaults = FLOOR_LAYOUT_DEFAULTS[room.floorFinish] || FLOOR_LAYOUT_DEFAULTS.laminate
  const settings = { ...defaults, ...(room.floorLayout || {}) }
  return analyzeSurfaceLayout(room.width, room.depth, settings)
}

export function buildRouteTakeoff(project) {
  const rows = []
  normalizeRoutes(project.routes).forEach((route) => {
    const spec = ROUTE_TYPES[route.type]
    const meters = routeLengthCm(route) / 100 * (1 + spec.reserve)
    rows.push({
      group: spec.group,
      name: spec.product,
      qty: round(meters, 1),
      unit: 'м',
      reserve: Math.round(spec.reserve * 100) + '%',
      note: route.name + ' · ' + round(routeLengthCm(route, false) / 100, 1) + ' м по плану',
    })
  })
  return rows
}

function wallAreaM2(wall) {
  const len = Math.hypot((wall.x2 || 0) - (wall.x1 || 0), (wall.y2 || 0) - (wall.y1 || 0)) / 100
  const open = (wall.openings || []).reduce((sum, opening) => sum + (opening.width || 0) * (opening.height || 0) / 10000, 0)
  return Math.max(0, len * (wall.height || 270) / 100 - open)
}

const materialDensity = {
  brick: 1700,
  block: 600,
  drywall: 250,
  concrete: 2400,
  existing: 1200,
}

export function buildDemolitionTakeoff(project) {
  const rows = []
  let wasteVolume = 0
  let wasteMass = 0
  const add = (name, qty, unit, note) => {
    if (qty > 0) rows.push({ group: 'Демонтаж', name, qty: round(qty, unit === 'т' ? 2 : 1), unit, reserve: '—', note })
  }

  ;(project.freeWalls || []).filter((wall) => (wall.phase || 'existing') === 'demolish').forEach((wall) => {
    const area = wallAreaM2(wall)
    const volume = area * (wall.thickness || 120) / 1000
    const density = materialDensity[wall.material] || 1200
    wasteVolume += volume
    wasteMass += volume * density
    add('Демонтаж стены: ' + (wall.name || 'стена'), area, 'м²', 'Материал: ' + (wall.material || 'не указан'))
  })

  const seenRoomWalls = new Set()
  ;(project.rooms || []).forEach((room) => {
    const coords = {
      north: [room.x, room.y, room.x + room.width, room.y],
      south: [room.x, room.y + room.depth, room.x + room.width, room.y + room.depth],
      west: [room.x, room.y, room.x, room.y + room.depth],
      east: [room.x + room.width, room.y, room.x + room.width, room.y + room.depth],
    }
    Object.entries(room.walls || {}).forEach(([side, wall]) => {
      if ((wall.phase || 'existing') !== 'demolish') return
      const c = coords[side]
      const p1 = c[0] + ',' + c[1]
      const p2 = c[2] + ',' + c[3]
      const key = p1 < p2 ? p1 + '|' + p2 : p2 + '|' + p1
      if (seenRoomWalls.has(key)) return
      seenRoomWalls.add(key)
      const lengthM = Math.hypot(c[2] - c[0], c[3] - c[1]) / 100
      const openings = (wall.openings || []).reduce((sum, opening) => sum + (opening.width || 0) * (opening.height || 0) / 10000, 0)
      const area = Math.max(0, lengthM * room.height / 100 - openings)
      const volume = area * (wall.thickness || 120) / 1000
      const density = materialDensity[wall.material] || 1200
      wasteVolume += volume
      wasteMass += volume * density
      add('Демонтаж стены: ' + room.name + ' · ' + side, area, 'м²', 'Материал: ' + (wall.material || 'не указан'))
    })
  })

  ;(project.rooms || []).forEach((room) => {
    const area = room.width * room.depth / 10000
    if (room.demolition?.floor) {
      const thickness = Math.max(1, Number(room.demolition.floorThickness) || 5) / 100
      const volume = area * thickness
      wasteVolume += volume
      wasteMass += volume * 1800
      add('Снять пол: ' + room.name, area, 'м²', 'Ориентир слоя ' + Math.round(thickness * 100) + ' см')
    }
    if (room.demolition?.wallFinish) {
      const perimeter = 2 * (room.width + room.depth) / 100
      const wallArea = perimeter * room.height / 100
      const volume = wallArea * .012
      wasteVolume += volume
      wasteMass += volume * 1500
      add('Снять отделку стен: ' + room.name, wallArea, 'м²', 'Ориентир для штукатурки/плитки; уточнить фактический слой')
    }
    if (room.demolition?.ceiling) add('Демонтаж потолка: ' + room.name, area, 'м²', 'Тип потолка уточнить перед оценкой отходов')
  })

  add('Строительные отходы', wasteVolume, 'м³', 'Расчётный объём без коэффициента разрыхления')
  add('Расчётная масса отходов', wasteMass / 1000, 'т', 'Приблизительно; для вывоза учитывать фактическую плотность и упаковку')
  return rows
}

export function buildReinforcementTakeoff(project) {
  let area = 0
  const consume = (wall, lengthCm, heightCm) => {
    if (wall?.material !== 'drywall' || !wall?.reinforcement) return
    const band = clamp(wall.reinforcementHeight || 80, 20, Math.min(200, heightCm || 270))
    area += lengthCm / 100 * band / 100 * 1.1
  }
  ;(project.rooms || []).forEach((room) => {
    const sides = {
      north: room.width, south: room.width, east: room.depth, west: room.depth,
    }
    Object.entries(sides).forEach(([side, len]) => consume(room.walls?.[side], len, room.height))
  })
  ;(project.freeWalls || []).forEach((wall) => consume(wall, Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1), wall.height))
  if (!area) return []
  return [{
    group: 'Стены · усиление',
    name: 'Фанера / OSB для закладных',
    qty: round(area, 1),
    unit: 'м²',
    reserve: '10%',
    note: 'По стенам с отмеченным усилением под подвесные нагрузки',
  }]
}

export function buildAdvancedTakeoff(project) {
  return [
    ...buildRouteTakeoff(project),
    ...buildDemolitionTakeoff(project),
    ...buildReinforcementTakeoff(project),
  ]
}

const packageRules = [
  { test: /Плитка/i, size: 1.44, unit: 'кор.' },
  { test: /Ламинат/i, size: 2.2, unit: 'уп.' },
  { test: /Кварц|винил/i, size: 2.2, unit: 'уп.' },
  { test: /Паркет|инженерная доска/i, size: 2.0, unit: 'уп.' },
  { test: /Подложка/i, size: 10, unit: 'рул.' },
  { test: /Плинтус/i, size: 2.5, unit: 'шт' },
  { test: /^П[НС] \d+/i, size: 3, unit: 'шт' },
  { test: /Грунтовка/i, size: 10, unit: 'кан.' },
  { test: /Минеральная вата/i, size: 6, unit: 'уп.' },
  { test: /обои/i, size: 5.3, unit: 'рул.' },
  { test: /кабель|труба/i, size: 1, unit: 'м' },
]

export function packageTakeoff(rows, overrides = {}) {
  return (rows || []).map((row) => {
    const override = overrides[row.group + '|' + row.name]
    const rule = packageRules.find((item) => item.test.test(row.name))
    const size = Number(override?.size || rule?.size || 1)
    const packUnit = override?.unit || rule?.unit || row.unit
    const packs = row.unit === 'шт' && size === 1 ? Math.ceil(row.qty) : Math.ceil((Number(row.qty) || 0) / size)
    return { ...row, packageSize: size, packageUnit: packUnit, packages: packs }
  })
}

export function buildWorkPlan(project) {
  const tasks = []
  const add = (id, title, detail, depends = []) => tasks.push({ id, title, detail, depends })
  add('measure', 'Контрольный обмер', 'Размеры, диагонали, высоты, перепады и привязки инженерии.', [])
  const demolition = buildDemolitionTakeoff(project).some((row) => row.name !== 'Строительные отходы' && row.name !== 'Расчётная масса отходов')
  if (demolition) add('demolition', 'Демонтаж', 'Удалить отмеченные конструкции и покрытия, вывезти отходы.', ['measure'])
  const base = demolition ? 'demolition' : 'measure'
  const hasNewWalls = (project.freeWalls || []).some((wall) => (wall.phase || 'new') === 'new') || (project.rooms || []).some((room) => Object.values(room.walls || {}).some((wall) => (wall.phase || 'existing') === 'new'))
  if (hasNewWalls) add('walls', 'Новые перегородки и проёмы', 'Каркас/кладка, усиления и подготовка проёмов.', [base])
  const roughBase = hasNewWalls ? 'walls' : base
  const routes = normalizeRoutes(project.routes)
  if (routes.some((route) => route.layer === 'electrical')) add('electrical', 'Черновая электрика', 'Трассы, подрозетники, коробки и проверка групп.', [roughBase])
  if (routes.some((route) => route.layer === 'plumbing')) add('plumbing', 'Вода и канализация', 'Трассы, уклоны, опрессовка и фотофиксация скрытых участков.', [roughBase])
  if (routes.some((route) => route.layer === 'heating')) add('heating', 'Отопление', 'Трассы и приборы до закрытия конструкций.', [roughBase])
  const roughIds = tasks.filter((task) => ['electrical', 'plumbing', 'heating'].includes(task.id)).map((task) => task.id)
  if ((project.freeWalls || []).some((wall) => wall.material === 'drywall') || (project.rooms || []).some((room) => Object.values(room.walls || {}).some((wall) => wall.material === 'drywall'))) {
    add('close-walls', 'Закрытие ГКЛ и швы', 'Перед зашивкой проверить скрытые коммуникации и закладные.', roughIds.length ? roughIds : [roughBase])
  }
  const finishBase = tasks.some((task) => task.id === 'close-walls') ? 'close-walls' : (roughIds.at(-1) || roughBase)
  if ((project.rooms || []).some((room) => room.floorFinish === 'tile' || Object.values(room.walls || {}).some((wall) => wall.finish === 'tile'))) {
    add('waterproof', 'Гидроизоляция мокрых зон', 'Основание, примыкания, манжеты и контроль высыхания.', [finishBase])
    add('tile', 'Плитка', 'Разметка раскладки, клей, швы и примыкания.', ['waterproof'])
  }
  add('finish-walls', 'Чистовая отделка стен и потолков', 'Грунт, шпаклёвка/краска/обои/панели по выбранным помещениям.', [finishBase])
  add('floor', 'Чистовой пол', 'Проверить влажность и плоскость основания, затем укладка покрытия.', ['finish-walls'])
  add('finish-engineering', 'Чистовая электрика и сантехника', 'Механизмы, приборы, герметизация и функциональные проверки.', ['floor'])
  add('handover', 'Финальная проверка', 'Пройти чек-лист, размеры, уклоны, протечки, группы и запас материалов.', ['finish-engineering'])
  return tasks
}

export function roomPassport(room) {
  const area = room.width * room.depth / 10000
  const perimeter = 2 * (room.width + room.depth) / 100
  const openings = Object.values(room.walls || {}).reduce((sum, wall) => sum + (wall.openings?.length || 0), 0)
  const layout = analyzeRoomFloorLayout(room)
  return {
    id: room.id,
    name: room.name,
    area: round(area, 2),
    perimeter: round(perimeter, 2),
    height: room.height,
    openings,
    floorFinish: room.floorFinish,
    ceilingFinish: room.ceilingFinish,
    layout,
  }
}

export function topologyPassport(project, room, index) {
  const meta = topologyMetaFor(project, room, index)
  return {
    id: room.id,
    name: meta.name,
    area: round(room.area, 2),
    perimeter: round(room.perimeter, 2),
    height: meta.height,
    openings: 0,
    floorFinish: meta.floorFinish,
    ceilingFinish: meta.ceilingFinish,
    layout: null,
  }
}

function theoreticalDiagonal(room) {
  return Math.hypot(room.width || 0, room.depth || 0)
}

export function validateAdvancedProject(project) {
  const issues = []
  const push = (severity, title, detail) => issues.push({ id: 'adv-' + severity + '-' + issues.length, severity, title, detail })
  const routes = normalizeRoutes(project.routes)

  routes.forEach((route) => {
    const spec = ROUTE_TYPES[route.type]
    if (!spec) return
    if (route.points.length < 2) push('error', route.name + ': трасса не завершена', 'Нужно минимум две точки.')
    if (route.type.startsWith('drain-')) {
      const required = Number(route.slope || spec.slope || 0)
      const actual = routeActualSlope(route)
      if (actual + .15 < required) push('warn', route.name + ': недостаточный уклон', 'Задано ' + round(actual, 2) + '%, требуется около ' + required + '%.')
    }
  })
  if (routes.some((route) => route.type.startsWith('drain-')) && !(project.engineering?.plumbing || []).some((item) => item.type === 'riser')) {
    push('warn', 'Канализационные трассы без стояка', 'Добавьте точку стояка, чтобы схема имела явную опорную точку.')
  }

  ;(project.rooms || []).forEach((room) => {
    const theoretical = theoreticalDiagonal(room)
    const toleranceCm = Math.max(.1, Number(room.toleranceMm || 10) / 10)
    for (const [name, value] of [['A', room.diagonalA], ['B', room.diagonalB]]) {
      if (Number(value) > 0 && Math.abs(Number(value) - theoretical) > toleranceCm) {
        push('warn', room.name + ': диагональ ' + name + ' не сходится', 'Теория ' + round(theoretical, 1) + ' см, замер ' + round(value, 1) + ' см, допуск ' + toleranceCm + ' см.')
      }
    }
    const layout = analyzeRoomFloorLayout(room)
    if (layout?.warning) push('info', room.name + ': раскладка пола', layout.warning + '. Рассмотрите смещение старта или другой формат.')
  })

  const allWalls = []
  ;(project.rooms || []).forEach((room) => Object.entries(room.walls || {}).forEach(([side, wall]) => allWalls.push({ wall, name: room.name + ' · ' + side })))
  ;(project.freeWalls || []).forEach((wall) => allWalls.push({ wall, name: wall.name || 'Свободная стена' }))
  allWalls.forEach(({ wall, name }) => {
    if (wall.material === 'drywall' && Number(wall.loadKg) > 15 && !wall.reinforcement) {
      push('warn', name + ': тяжёлая нагрузка без закладной', 'Указано ' + wall.loadKg + ' кг. Добавьте усиление или проверьте систему крепления.')
    }
    if (wall.finish === 'tile') {
      const layout = analyzeSurfaceLayout(300, wall.height || 270, wall.tileLayout || TILE_LAYOUT_DEFAULT)
      if (layout.warning) push('info', name + ': плитка', layout.warning + '. Точный результат зависит от длины стены.')
    }
  })

  const topoRooms = buildTopologyRooms(project.freeWalls, 'proposed')
  if ((project.freeWalls || []).filter((wall) => wallVisibleForPhase(wall, 'proposed')).length >= 3 && !topoRooms.length) {
    push('info', 'Свободные стены пока не образуют замкнутое помещение', 'Замкните контур — площадь и 3D-пол появятся автоматически.')
  }
  return issues
}

export function snapshotProject(project) {
  const clone = JSON.parse(JSON.stringify(project))
  if (clone.underlay) clone.underlay = { ...clone.underlay, dataUrl: '' }
  return clone
}
