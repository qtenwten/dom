export const EQUIPMENT_PROFILES = {
  socket: {
    'ru-iek-solid-68x45': {
      label: 'IEK · твёрдая стена Ø68×45',
      shape: 'circle',
      diameterMm: 68,
      depthMm: 45,
      holeMinMm: 68,
      holeMaxMm: 72,
      centerSpacingMm: 71,
      screwSpacingMm: 60,
      posts: 1,
      basis: 'IEK: Ø68 мм, глубина 45 мм, коронка 68–72 мм, межосевое 71 мм, винты 60 мм.',
      product: 'Коробка установочная Ø68×45',
    },
    'ru-iek-deep-68x60': {
      label: 'IEK · глубокая Ø68×60',
      shape: 'circle',
      diameterMm: 68,
      depthMm: 60,
      holeMinMm: 68,
      holeMaxMm: 72,
      centerSpacingMm: 71,
      screwSpacingMm: 60,
      posts: 1,
      basis: 'IEK выпускает установочные коробки Ø68 мм глубиной 40, 45 и 60 мм; коронка 68–72 мм.',
      product: 'Коробка установочная Ø68×60',
    },
    'ru-schneider-67x40': {
      label: 'Schneider Multifix Air Ø67×40',
      shape: 'circle',
      diameterMm: 67,
      depthMm: 40,
      holeMinMm: 67,
      holeMaxMm: 68,
      centerSpacingMm: 71,
      screwSpacingMm: 60,
      posts: 1,
      basis: 'Schneider Multifix Air: Ø67 мм, глубина около 40 мм; многопостовые коробки имеют межосевое 71 мм.',
      product: 'Коробка установочная Ø67×40',
    },
    'ru-schneider-67x47': {
      label: 'Schneider Multifix Air Ø67×47',
      shape: 'circle',
      diameterMm: 67,
      depthMm: 47,
      holeMinMm: 67,
      holeMaxMm: 68,
      centerSpacingMm: 71,
      screwSpacingMm: 60,
      posts: 1,
      basis: 'Schneider Multifix Air: Ø67 мм, глубина 47 мм; многопостовые коробки имеют межосевое 71 мм.',
      product: 'Коробка установочная Ø67×47',
    },
    'ru-ekf-hollow-71x45': {
      label: 'EKF КМП · 71×45',
      shape: 'circle',
      diameterMm: 71,
      depthMm: 45,
      holeMinMm: 71,
      holeMaxMm: 72,
      centerSpacingMm: 71,
      screwSpacingMm: 60,
      posts: 1,
      basis: 'EKF КМП-020-011: диаметр 71 мм, внутренняя глубина 45 мм; в одной рамке применяется межосевое 71 мм.',
      product: 'Коробка установочная 71×45',
    },
  },
  switch: {},
  light: {
    'ru-cable-outlet-custom': {
      label: 'Точка вывода кабеля · габарит по изделию',
      shape: 'circle',
      diameterMm: 20,
      depthMm: 0,
      basis: 'Единого габарита светильника нет. На плане хранится точка вывода кабеля; размер светильника задаётся отдельно.',
      product: 'Точка вывода кабеля',
      symbolic: true,
    },
  },
  junction: {
    'ru-iek-80x80x40': {
      label: 'IEK · 80×80×40',
      shape: 'rect',
      widthMm: 80,
      heightMm: 80,
      depthMm: 40,
      basis: 'IEK выпускает распределительные коробки 80×80×40 мм.',
      product: 'Коробка распределительная 80×80×40',
    },
    'ru-iek-100x100x50': {
      label: 'IEK · 100×100×50',
      shape: 'rect',
      widthMm: 100,
      heightMm: 100,
      depthMm: 50,
      basis: 'IEK: распределительная коробка 100×100×50 мм.',
      product: 'Коробка распределительная 100×100×50',
    },
    'ru-iek-150x110x70': {
      label: 'IEK · 150×110×70',
      shape: 'rect',
      widthMm: 150,
      heightMm: 110,
      depthMm: 70,
      basis: 'IEK выпускает распределительные коробки 150×110×70 мм.',
      product: 'Коробка распределительная 150×110×70',
    },
  },
  water: {
    'ru-water-16-g12': {
      label: 'Водорозетка 16 × G1/2',
      shape: 'circle',
      diameterMm: 50,
      depthMm: 50,
      connection: '16 мм × G1/2',
      basis: 'Типовое подключение водорозетки: труба 16 мм и внутренняя резьба G1/2. Корпус у разных производителей отличается — габарит редактируемый.',
      product: 'Водорозетка 16 × 1/2',
      symbolic: true,
    },
    'ru-water-mixer-150': {
      label: 'Пара водорозеток · 150 мм',
      shape: 'pair',
      diameterMm: 50,
      depthMm: 50,
      centerSpacingMm: 150,
      posts: 2,
      connection: '16 мм × G1/2',
      basis: 'Монтажные планки VALTEC поддерживают межосевое 150 мм для смесителей; встречаются также 75 и 100 мм.',
      product: 'Комплект водорозеток для смесителя',
      symbolic: true,
    },
    'ru-water-mixer-100': {
      label: 'Пара водорозеток · 100 мм',
      shape: 'pair',
      diameterMm: 50,
      depthMm: 50,
      centerSpacingMm: 100,
      posts: 2,
      connection: '16 мм × G1/2',
      basis: 'У монтажных планок встречается регулируемое межосевое 100 мм.',
      product: 'Комплект водорозеток',
      symbolic: true,
    },
    'ru-water-mixer-75': {
      label: 'Пара водорозеток · 75 мм',
      shape: 'pair',
      diameterMm: 50,
      depthMm: 50,
      centerSpacingMm: 75,
      posts: 2,
      connection: '16 мм × G1/2',
      basis: 'У монтажных планок встречается регулируемое межосевое 75 мм.',
      product: 'Комплект водорозеток',
      symbolic: true,
    },
  },
  drain: {
    'ru-drain-dn32': { label: 'Канализация DN32', shape: 'circle', diameterMm: 32, depthMm: 0, nominal: 'DN32', basis: 'Внутренняя канализация: DN32 встречается в сериях полипропиленовых труб.', product: 'Труба канализационная DN32' },
    'ru-drain-dn40': { label: 'Канализация DN40', shape: 'circle', diameterMm: 40, depthMm: 0, nominal: 'DN40', basis: 'Внутренняя канализация: DN40.', product: 'Труба канализационная DN40' },
    'ru-drain-dn50': { label: 'Канализация DN50', shape: 'circle', diameterMm: 50, depthMm: 0, nominal: 'DN50', basis: 'Внутренняя канализация: DN50.', product: 'Труба канализационная DN50' },
    'ru-drain-dn75': { label: 'Канализация DN75', shape: 'circle', diameterMm: 75, depthMm: 0, nominal: 'DN75', basis: 'Внутренняя канализация: DN75.', product: 'Труба канализационная DN75' },
    'ru-drain-dn90': { label: 'Канализация DN90', shape: 'circle', diameterMm: 90, depthMm: 0, nominal: 'DN90', basis: 'Внутренняя канализация: DN90.', product: 'Труба канализационная DN90' },
    'ru-drain-dn110': { label: 'Канализация DN110', shape: 'circle', diameterMm: 110, depthMm: 0, nominal: 'DN110', basis: 'Внутренняя канализация: DN110.', product: 'Труба канализационная DN110' },
    'ru-drain-dn125': { label: 'Канализация DN125', shape: 'circle', diameterMm: 125, depthMm: 0, nominal: 'DN125', basis: 'Внутренняя канализация: DN125.', product: 'Труба канализационная DN125' },
    'ru-drain-dn160': { label: 'Канализация DN160', shape: 'circle', diameterMm: 160, depthMm: 0, nominal: 'DN160', basis: 'Внутренняя канализация: DN160.', product: 'Труба канализационная DN160' },
  },
  riser: {
    'ru-riser-drain-110': { label: 'Стояк канализации DN110', shape: 'circle', diameterMm: 110, depthMm: 0, nominal: 'DN110', basis: 'Для внутренней канализации доступен типоразмер DN110.', product: 'Стояк канализации DN110' },
    'ru-riser-drain-50': { label: 'Стояк канализации DN50', shape: 'circle', diameterMm: 50, depthMm: 0, nominal: 'DN50', basis: 'Для внутренней канализации доступен типоразмер DN50.', product: 'Стояк канализации DN50' },
  },
  radiator: {
    'custom-radiator': {
      label: 'Радиатор · по паспорту изделия',
      shape: 'rect',
      widthMm: 1000,
      heightMm: 500,
      depthMm: 100,
      basis: 'У радиаторов нет одного российского габарита: длина, высота и глубина зависят от типа и модели. Значения ниже редактируются.',
      product: 'Радиатор отопления',
      symbolic: true,
    },
  },
  manifold: {
    'custom-manifold': {
      label: 'Коллектор · по паспорту изделия',
      shape: 'rect',
      widthMm: 300,
      heightMm: 100,
      depthMm: 100,
      basis: 'Габарит коллектора зависит от числа выходов, расходомеров и шкафа. Значения ниже редактируются.',
      product: 'Коллектор',
      symbolic: true,
    },
  },
}

EQUIPMENT_PROFILES.switch = EQUIPMENT_PROFILES.socket

export const DEFAULT_PROFILE_BY_TYPE = {
  socket: 'ru-iek-solid-68x45',
  switch: 'ru-iek-solid-68x45',
  light: 'ru-cable-outlet-custom',
  junction: 'ru-iek-100x100x50',
  water: 'ru-water-16-g12',
  drain: 'ru-drain-dn50',
  riser: 'ru-riser-drain-110',
  radiator: 'custom-radiator',
  manifold: 'custom-manifold',
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0))

export function equipmentProfilesFor(type) {
  return Object.entries(EQUIPMENT_PROFILES[type] || {})
}

export function getEquipmentProfile(itemOrType) {
  const type = typeof itemOrType === 'string' ? itemOrType : itemOrType?.type
  const profileId = typeof itemOrType === 'string' ? DEFAULT_PROFILE_BY_TYPE[type] : itemOrType?.profileId
  const profiles = EQUIPMENT_PROFILES[type] || {}
  return profiles[profileId] || profiles[DEFAULT_PROFILE_BY_TYPE[type]] || Object.values(profiles)[0] || null
}

export function normalizeEquipmentFields(item, type) {
  const defaultId = DEFAULT_PROFILE_BY_TYPE[type]
  const profileId = EQUIPMENT_PROFILES[type]?.[item?.profileId] ? item.profileId : defaultId
  const profile = EQUIPMENT_PROFILES[type]?.[profileId] || {}
  return {
    profileId,
    posts: clamp(item?.posts ?? profile.posts ?? 1, 1, 8),
    diameterMm: clamp(item?.diameterMm ?? profile.diameterMm ?? 0, 0, 2000),
    widthMm: clamp(item?.widthMm ?? profile.widthMm ?? profile.diameterMm ?? 0, 0, 5000),
    heightMm: clamp(item?.heightMm ?? profile.heightMm ?? profile.diameterMm ?? 0, 0, 5000),
    depthMm: clamp(item?.depthMm ?? profile.depthMm ?? 0, 0, 2000),
    centerSpacingMm: clamp(item?.centerSpacingMm ?? profile.centerSpacingMm ?? 0, 0, 1000),
    screwSpacingMm: clamp(item?.screwSpacingMm ?? profile.screwSpacingMm ?? 0, 0, 1000),
    holeMinMm: clamp(item?.holeMinMm ?? profile.holeMinMm ?? 0, 0, 1000),
    holeMaxMm: clamp(item?.holeMaxMm ?? profile.holeMaxMm ?? 0, 0, 1000),
    rotationDeg: clamp(item?.rotationDeg ?? 0, -360, 360),
  }
}

export function applyEquipmentProfile(item, profileId) {
  const type = item?.type
  const profile = EQUIPMENT_PROFILES[type]?.[profileId]
  if (!profile) return item
  return {
    ...item,
    profileId,
    posts: profile.posts ?? item.posts ?? 1,
    diameterMm: profile.diameterMm ?? 0,
    widthMm: profile.widthMm ?? profile.diameterMm ?? 0,
    heightMm: profile.heightMm ?? profile.diameterMm ?? 0,
    depthMm: profile.depthMm ?? 0,
    centerSpacingMm: profile.centerSpacingMm ?? 0,
    screwSpacingMm: profile.screwSpacingMm ?? 0,
    holeMinMm: profile.holeMinMm ?? 0,
    holeMaxMm: profile.holeMaxMm ?? 0,
    rotationDeg: item.rotationDeg ?? 0,
  }
}

export function equipmentPlanGeometry(item) {
  const profile = getEquipmentProfile(item) || {}
  const shape = profile.shape || (item.widthMm && item.heightMm ? 'rect' : 'circle')
  const posts = clamp(item.posts || profile.posts || 1, 1, 8)
  const diameterCm = Math.max(.8, (Number(item.diameterMm || profile.diameterMm || 20)) / 10)
  const spacingCm = Math.max(0, (Number(item.centerSpacingMm || profile.centerSpacingMm || 0)) / 10)
  const widthCm = Math.max(.8, (Number(item.widthMm || profile.widthMm || item.diameterMm || profile.diameterMm || 20)) / 10)
  const planDepthCm = Math.max(.8, (Number(item.depthMm || profile.depthMm || item.diameterMm || profile.diameterMm || 20)) / 10)
  const totalWidthCm = shape === 'pair' || (posts > 1 && spacingCm > 0)
    ? diameterCm + spacingCm * (posts - 1)
    : widthCm
  const heightCm = shape === 'rect' ? planDepthCm : diameterCm
  return { shape, posts, diameterCm, spacingCm, widthCm: totalWidthCm, heightCm }
}

export function equipmentProductName(item) {
  const profile = getEquipmentProfile(item)
  if (!profile) return item?.type || 'Инженерная точка'
  if ((item?.type === 'socket' || item?.type === 'switch') && (item.posts || 1) > 1) {
    return `${profile.product || profile.label} · ${item.posts} пост.`
  }
  return profile.product || profile.label
}

export function equipmentBasis(item) {
  return getEquipmentProfile(item)?.basis || ''
}
