export function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  const days = Math.floor(hrs / 24)
  if (days < 30) return days + 'd ago'
  const months = Math.floor(days / 30)
  if (months < 12) return months + 'mo ago'
  return Math.floor(months / 12) + 'y ago'
}

export function hexToRgba(hex, opacity) {
  if (!hex || hex === 'transparent' || hex === 'none') return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 'rgba(' + r + ',' + g + ',' + b + ',' + (opacity == null ? 1 : opacity) + ')'
}

export function getDefaultShape(type) {
  const base = { x: '25%', y: '20%', w: '20%', h: '20%', rotation: 0, fill: 'transparent', stroke: '#6366f1', strokeWidth: 2, fillOpacity: 1, strokeOpacity: 1, text: '', fontSize: 14, color: '#ffffff', fontFamily: 'Poppins', textAlign: 'center' }
  switch (type) {
    case 'rect': return { ...base, type: 'rect' }
    case 'circle': return { ...base, type: 'circle' }
    case 'line': return { ...base, type: 'line', w: '30%', h: '0.3%', fill: 'none', stroke: '#ffffff', strokeWidth: 3, lineWeight: 3, lineDash: 'solid' }
    case 'arrow': return { ...base, type: 'arrow', w: '30%', h: '0.3%', fill: 'none', stroke: '#ffffff', strokeWidth: 3, lineWeight: 3, lineDash: 'solid' }
    case 'text': return { ...base, type: 'text', w: '20%', h: '8%', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, fillOpacity: 0, strokeOpacity: 0, text: 'Text', fontSize: 28, fontWeight: '400', fontStyle: 'normal', textDecoration: 'none', textAlign: 'center', direction: 'ltr', bgColor: 'transparent', bgOpacity: 0 }
    case 'image': return { ...base, type: 'image', w: '25%', h: '25%', src: '', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, fillOpacity: 0, strokeOpacity: 0 }
    default: return { ...base, type: 'rect' }
  }
}

export function formatTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return m + ':' + s
}
