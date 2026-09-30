import React, { useMemo } from 'react'
import {
  ROUTE_TYPES,
  TILE_LAYOUT_DEFAULT,
  analyzeSurfaceLayout,
  buildDemolitionTakeoff,
  buildTopologyRooms,
  buildWorkPlan,
  packageTakeoff,
  roomPassport,
  routeActualSlope,
  routeLengthCm,
  topologyMetaFor,
  topologyPassport,
} from './planner-advanced.js'

const FLOORS = {
  laminate: 'Ламинат',
  tile: 'Плитка',
  vinyl: 'Кварц-винил',
  parquet: 'Паркет / инженерная доска',
  screed: 'Стяжка',
}

const CEILINGS = {
  paint: 'Шпаклёвка + краска',
  stretch: 'Натяжной',
  drywall: 'ГКЛ',
  none: 'Без отделки',
}

function Field({ label, children }) {
  return <label className="advanced-field"><span>{label}</span>{children}</label>
}

function Num({ label, value, onChange, unit, min = 0, max = 10000, step = 1 }) {
  return <Field label={label}><div className="advanced-number"><input type="number" value={value ?? ''} min={min} max={max} step={step} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || 0)))} />{unit && <b>{unit}</b>}</div></Field>
}

function Select({ label, value, onChange, options }) {
  return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></Field>
}

export function UnderlayPanel({ underlay, onImport, onChange, onRemove, onStartCalibration, calibrating }) {
  return <section className="advanced-side-card">
    <div className="advanced-side-card__head"><div><small>ПОДЛОЖКА</small><strong>План / фото обмера</strong></div>{underlay && <button type="button" onClick={onRemove}>Удалить</button>}</div>
    {!underlay ? <>
      <p>Загрузите JPG, PNG или WEBP. Изображение сжимается перед сохранением в проект.</p>
      <label className="advanced-upload">Загрузить план<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => onImport(event.target.files?.[0])} /></label>
    </> : <>
      <div className="advanced-fields two">
        <Num label="X" value={underlay.x} unit="см" min={-5000} onChange={(x) => onChange({ x })} />
        <Num label="Y" value={underlay.y} unit="см" min={-5000} onChange={(y) => onChange({ y })} />
        <Num label="Ширина" value={underlay.width} unit="см" min={50} onChange={(width) => onChange({ width })} />
        <Num label="Прозрачность" value={Math.round(underlay.opacity * 100)} unit="%" min={5} max={100} onChange={(value) => onChange({ opacity: value / 100 })} />
        <Num label="Эталон" value={underlay.referenceCm} unit="см" min={1} onChange={(referenceCm) => onChange({ referenceCm })} />
      </div>
      <button className={calibrating ? 'advanced-action active' : 'advanced-action'} type="button" onClick={onStartCalibration}>{calibrating ? 'Кликните 2 точки на плане…' : 'Калибровать по 2 точкам'}</button>
      <p>Выберите две точки с известным расстоянием. Масштаб подложки пересчитается по значению «Эталон».</p>
    </>}
  </section>
}

export function RouteToolbox({ layer, activeType, drawing, draftCount, onChoose, onFinish, onCancel }) {
  const entries = Object.entries(ROUTE_TYPES).filter(([, spec]) => spec.layer === layer)
  if (!entries.length) return null
  return <section className="advanced-side-card">
    <div className="advanced-side-card__head"><div><small>ТРАССЫ</small><strong>Линии коммуникаций</strong></div>{drawing && <span>{draftCount} точ.</span>}</div>
    <div className="route-tool-grid">{entries.map(([key, spec]) => <button key={key} type="button" className={drawing && activeType === key ? 'active' : ''} onClick={() => onChoose(key)}><b>{spec.glyph}</b><span>{spec.label}</span></button>)}</div>
    {drawing && <div className="advanced-inline-actions"><button type="button" disabled={draftCount < 2} onClick={onFinish}>Сохранить трассу</button><button type="button" onClick={onCancel}>Отмена</button></div>}
    <p>Кликайте точки трассы на плане. Для канализации после сохранения задайте начальную/конечную отметку и уклон.</p>
  </section>
}

export function TopologyRoomInspector({ project, room, index, onChange }) {
  const meta = topologyMetaFor(project, room, index)
  return <div className="planner-inspector__content">
    <div className="topology-badge"><span>TOPO</span><div><small>Автоматически найденный контур</small><strong>{meta.name}</strong></div></div>
    <Field label="Название"><input value={meta.name} onChange={(event) => onChange({ name: event.target.value.slice(0, 60) })} /></Field>
    <div className="advanced-fields two">
      <Select label="Пол" value={meta.floorFinish} options={Object.entries(FLOORS)} onChange={(floorFinish) => onChange({ floorFinish })} />
      <Select label="Потолок" value={meta.ceilingFinish} options={Object.entries(CEILINGS)} onChange={(ceilingFinish) => onChange({ ceilingFinish })} />
      <Num label="Высота" value={meta.height} unit="см" min={180} max={1000} onChange={(height) => onChange({ height })} />
    </div>
    <div className="topology-stats"><div><small>Площадь</small><strong>{room.area.toFixed(2)} м²</strong></div><div><small>Периметр</small><strong>{room.perimeter.toFixed(2)} м</strong></div><div><small>Стен</small><strong>{room.sourceWallIds.length}</strong></div></div>
    <p className="advanced-note">Контур вычисляется из произвольных стен. Если разомкнуть стену, помещение исчезнет автоматически, но метаданные сохранятся в проекте.</p>
  </div>
}

export function RouteInspector({ route, onChange, onDelete }) {
  const spec = ROUTE_TYPES[route.type]
  const length = routeLengthCm(route, false) / 100
  const actualSlope = routeActualSlope(route)
  return <div className="planner-inspector__content">
    <div className="topology-badge route"><span>{spec?.glyph || 'TR'}</span><div><small>Инженерная трасса</small><strong>{route.name}</strong></div></div>
    <Field label="Название"><input value={route.name} onChange={(event) => onChange({ name: event.target.value.slice(0, 80) })} /></Field>
    <div className="advanced-fields two">
      <Num label="Начало" value={route.startHeight} unit="см" min={0} max={1000} onChange={(startHeight) => onChange({ startHeight })} />
      <Num label="Конец" value={route.endHeight} unit="см" min={0} max={1000} onChange={(endHeight) => onChange({ endHeight })} />
      {route.type.startsWith('drain-') && <Num label="Треб. уклон" value={route.slope} unit="%" min={0} max={20} step={.1} onChange={(slope) => onChange({ slope })} />}
    </div>
    <div className="route-summary"><span>По плану <b>{length.toFixed(2)} м</b></span>{route.type.startsWith('drain-') && <span>Фактически <b>{actualSlope.toFixed(2)}%</b></span>}</div>
    <Field label="Примечание"><textarea rows="3" value={route.note || ''} onChange={(event) => onChange({ note: event.target.value.slice(0, 160) })} /></Field>
    <div className="planner-danger-actions"><button type="button" onClick={onDelete}>Удалить трассу</button></div>
  </div>
}

function wallLength(room, side) {
  return side === 'north' || side === 'south' ? room.width : room.depth
}

function PlanSheet({ project, layer = 'architecture', title }) {
  const topologyRooms = buildTopologyRooms(project.freeWalls, 'proposed')
  const xs = []
  const ys = []
  ;(project.rooms || []).forEach((room) => { xs.push(room.x, room.x + room.width); ys.push(room.y, room.y + room.depth) })
  ;(project.freeWalls || []).forEach((wall) => { xs.push(wall.x1, wall.x2); ys.push(wall.y1, wall.y2) })
  if (!xs.length) { xs.push(0, 1000); ys.push(0, 700) }
  const pad = 70
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const width = Math.max(600, Math.max(...xs) - Math.min(...xs) + pad * 2)
  const height = Math.max(420, Math.max(...ys) - Math.min(...ys) + pad * 2)
  const routes = (project.routes || []).filter((route) => route.layer === layer)
  const points = (items) => items.map((p) => p.x + ',' + p.y).join(' ')
  return <div className="plan-sheet">
    <div className="plan-sheet__head"><strong>{title}</strong><small>{layer === 'architecture' ? 'АР' : layer === 'electrical' ? 'ЭОМ' : layer === 'plumbing' ? 'ВК' : 'ОВ'}</small></div>
    <svg viewBox={minX + ' ' + minY + ' ' + width + ' ' + height}>
      {topologyRooms.map((room, index) => <g key={room.signature}><polygon points={points(room.points)} className="sheet-room" /><text x={room.centroid.x} y={room.centroid.y} textAnchor="middle">{topologyMetaFor(project, room, index).name} · {room.area.toFixed(1)} м²</text></g>)}
      {(project.rooms || []).map((room) => <g key={room.id}><rect x={room.x} y={room.y} width={room.width} height={room.depth} className="sheet-room legacy" /><text x={room.x + room.width / 2} y={room.y + room.depth / 2} textAnchor="middle">{room.name} · {(room.width * room.depth / 10000).toFixed(1)} м²</text></g>)}
      {(project.freeWalls || []).filter((wall) => wall.phase !== 'demolish').map((wall) => <line key={wall.id} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} className="sheet-wall" />)}
      {routes.map((route) => <polyline key={route.id} points={points(route.points)} className={'sheet-route ' + route.layer} />)}
      {layer !== 'architecture' && (project.engineering?.[layer] || []).map((item) => <g key={item.id} className="sheet-point"><circle cx={item.x} cy={item.y} r="10" /><text x={item.x} y={item.y + 3} textAnchor="middle">{item.type.slice(0, 1).toUpperCase()}</text></g>)}
    </svg>
  </div>
}

function ElevationSvg({ title, length, height, wall }) {
  const w = Math.max(50, length)
  const h = Math.max(50, height)
  const tile = wall.finish === 'tile' ? analyzeSurfaceLayout(w, h, wall.tileLayout || TILE_LAYOUT_DEFAULT) : null
  const patternId = 'tile-' + Math.random().toString(36).slice(2, 8)
  const openings = wall.openings || []
  return <div className="elevation-card">
    <div className="elevation-card__head"><div><strong>{title}</strong><small>{(length / 100).toFixed(2)} × {(height / 100).toFixed(2)} м</small></div>{tile && <span>{tile.boxes} кор.</span>}</div>
    <svg viewBox={'-35 -35 ' + (w + 70) + ' ' + (h + 70)} role="img" aria-label={'Развертка ' + title}>
      <defs>{tile && <pattern id={patternId} width={tile.tileW + tile.joint} height={tile.tileH + tile.joint} patternUnits="userSpaceOnUse"><rect width={tile.tileW} height={tile.tileH} className="elevation-tile" /></pattern>}</defs>
      <rect x="0" y="0" width={w} height={h} className="elevation-wall" fill={tile ? 'url(#' + patternId + ')' : undefined} />
      {openings.map((opening) => {
        const y = h - (opening.sill || 0) - opening.height
        return <g key={opening.id}><rect x={opening.offset} y={Math.max(0, y)} width={opening.width} height={opening.height} className={'elevation-opening ' + opening.type} /><text x={opening.offset + opening.width / 2} y={Math.max(12, y + opening.height / 2)} textAnchor="middle">{opening.type === 'door' ? 'Дверь' : 'Окно'}</text></g>
      })}
      <line x1="0" y1={h + 18} x2={w} y2={h + 18} className="elevation-dim" /><text x={w / 2} y={h + 31} textAnchor="middle">{length} см</text>
      <line x1="-18" y1="0" x2="-18" y2={h} className="elevation-dim" /><text x="-23" y={h / 2} textAnchor="middle" transform={'rotate(-90 -23 ' + h / 2 + ')'}>{height} см</text>
    </svg>
    {tile?.warning && <small className="layout-warning">⚠ {tile.warning}</small>}
  </div>
}

function SectionSvg({ room }) {
  const width = room.width
  const height = room.height
  return <div className="section-card">
    <div><strong>Разрез · {room.name}</strong><small>Чистая высота {height} см</small></div>
    <svg viewBox={'-50 -40 ' + (width + 100) + ' ' + (height + 100)}>
      <rect x="0" y="0" width={width} height={height} className="section-space" />
      <line x1="0" y1={height} x2={width} y2={height} className="section-floor" />
      <line x1="0" y1="0" x2={width} y2="0" className="section-ceiling" />
      <line x1="-22" y1="0" x2="-22" y2={height} className="elevation-dim" />
      <text x="-28" y={height / 2} textAnchor="middle" transform={'rotate(-90 -28 ' + height / 2 + ')'}>{height} см</text>
      <text x={width / 2} y={height / 2} textAnchor="middle">{(room.width / 100).toFixed(2)} м</text>
    </svg>
  </div>
}

export function WorkPlanView({ project }) {
  const tasks = useMemo(() => buildWorkPlan(project), [project])
  const demolition = useMemo(() => buildDemolitionTakeoff(project), [project])
  return <div className="advanced-report">
    <div className="advanced-report__head"><div><small>ПОСЛЕДОВАТЕЛЬНОСТЬ</small><h2>План производства работ</h2><p>Строится из текущей модели: демонтаж, перегородки, инженерия и чистовые этапы.</p></div><b>{tasks.length} этапов</b></div>
    <div className="work-flow">{tasks.map((task, index) => <article key={task.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{task.title}</strong><p>{task.detail}</p>{task.depends.length > 0 && <small>После: {task.depends.join(', ')}</small>}</div></article>)}</div>
    {demolition.length > 0 && <section className="advanced-table"><h3>Демонтаж и отходы</h3>{demolition.map((row) => <div key={row.name}><span>{row.name}<small>{row.note}</small></span><b>{row.qty} {row.unit}</b></div>)}</section>}
  </div>
}

export function DocumentsView({ project, rows, versions, onSaveVersion, onRestoreVersion, onDeleteVersion, onPrint }) {
  const topologyRooms = useMemo(() => buildTopologyRooms(project.freeWalls, 'proposed'), [project.freeWalls])
  const passports = [
    ...(project.rooms || []).map(roomPassport),
    ...topologyRooms.map((room, index) => topologyPassport(project, room, index)),
  ]
  const packedRows = packageTakeoff(rows || [], project.packageOverrides || {})
  const elevations = []
  ;(project.rooms || []).forEach((room) => {
    Object.entries(room.walls || {}).forEach(([side, wall]) => elevations.push({
      key: room.id + '-' + side,
      title: room.name + ' · ' + side,
      length: wallLength(room, side),
      height: room.height,
      wall,
    }))
  })
  ;(project.freeWalls || []).forEach((wall) => elevations.push({
    key: wall.id,
    title: wall.name || 'Свободная стена',
    length: Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1),
    height: wall.height,
    wall,
  }))

  return <div className="planner-documents">
    <header className="documents-hero"><div><span>КОМПЛЕКТ ЧЕРТЕЖЕЙ</span><h2>{project.name}</h2><p>Паспорта помещений, развертки стен, разрезы, закупка и версии проекта.</p></div><div><button type="button" onClick={onSaveVersion}>Сохранить версию</button><button type="button" onClick={onPrint}>Печать / PDF</button></div></header>

    <section className="document-section">
      <div className="document-section__head"><div><small>01</small><h3>Планы</h3></div><span>4 листа</span></div>
      <div className="plan-sheet-grid">
        <PlanSheet project={project} layer="architecture" title="Архитектурный план" />
        <PlanSheet project={project} layer="electrical" title="План электрики" />
        <PlanSheet project={project} layer="plumbing" title="План воды и канализации" />
        <PlanSheet project={project} layer="heating" title="План отопления" />
      </div>
    </section>

    <section className="document-section">
      <div className="document-section__head"><div><small>02</small><h3>Паспорта помещений</h3></div><span>{passports.length}</span></div>
      <div className="passport-grid">{passports.map((room) => <article key={room.id}><div><small>ПОМЕЩЕНИЕ</small><strong>{room.name}</strong></div><dl><div><dt>Площадь</dt><dd>{room.area} м²</dd></div><div><dt>Периметр</dt><dd>{room.perimeter} м</dd></div><div><dt>Высота</dt><dd>{room.height} см</dd></div><div><dt>Проёмы</dt><dd>{room.openings}</dd></div><div><dt>Пол</dt><dd>{FLOORS[room.floorFinish] || room.floorFinish}</dd></div><div><dt>Потолок</dt><dd>{CEILINGS[room.ceilingFinish] || room.ceilingFinish}</dd></div></dl>{room.layout?.warning && <p>⚠ {room.layout.warning}</p>}</article>)}</div>
    </section>

    <section className="document-section">
      <div className="document-section__head"><div><small>03</small><h3>Развертки стен</h3></div><span>{elevations.length}</span></div>
      <div className="elevation-grid">{elevations.map((item) => <ElevationSvg key={item.key} {...item} />)}</div>
    </section>

    {project.rooms?.length > 0 && <section className="document-section">
      <div className="document-section__head"><div><small>04</small><h3>Разрезы</h3></div><span>{project.rooms.length}</span></div>
      <div className="section-grid">{project.rooms.map((room) => <SectionSvg key={room.id} room={room} />)}</div>
    </section>}

    <section className="document-section">
      <div className="document-section__head"><div><small>05</small><h3>Закупка по упаковкам</h3></div><span>{packedRows.length}</span></div>
      <div className="advanced-table">{packedRows.map((row, index) => <div key={row.group + row.name + index}><span><strong>{row.name}</strong><small>{row.qty} {row.unit} · {row.note}</small></span><b>{row.packages} {row.packageUnit}</b></div>)}</div>
    </section>

    <section className="document-section no-print">
      <div className="document-section__head"><div><small>06</small><h3>История версий</h3></div><button type="button" onClick={onSaveVersion}>+ Снимок</button></div>
      <div className="versions-list">{versions.length ? versions.map((version) => <div key={version.id}><div><strong>{version.name}</strong><small>{new Date(version.createdAt).toLocaleString('ru-RU')}</small></div><span>{version.summary || 'Снимок проекта'}</span><div><button type="button" onClick={() => onRestoreVersion(version)}>Восстановить</button><button type="button" onClick={() => onDeleteVersion(version.id)}>Удалить</button></div></div>) : <p>Сохранённых снимков пока нет.</p>}</div>
    </section>
  </div>
}
