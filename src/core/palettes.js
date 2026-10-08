// Each palette is a fabric ground and two thread colors. `a` runs left to right
// (weft), `b` runs top to bottom (warp). `ink` is for the print's text.

export const PALETTES = {
  coral: { name: 'Coral and indigo', ground: '#f5eee3', a: '#e4573d', b: '#2c3a8c', ink: '#1d1b26', soft: '#8b8576' },
  sage: { name: 'Sage and cream', ground: '#1c2a25', a: '#8fb08b', b: '#f1e7cd', ink: '#f1e7cd', soft: '#8aa093' },
  amber: { name: 'Amber and plum', ground: '#fbf4e8', a: '#c07a10', b: '#5a2a63', ink: '#2a1a2c', soft: '#8d7f78' },
}

export const PALETTE_IDS = Object.keys(PALETTES)
export const DEFAULT_PALETTE = 'coral'

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG contrast ratio between two #rrggbb colors. */
export function contrast(x, y) {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}

/** Mixes two #rrggbb colors; t is how much of `to` to take. */
export function mix(from, to, t) {
  const part = (i) => Math.round(parseInt(from.slice(i, i + 2), 16) * (1 - t) + parseInt(to.slice(i, i + 2), 16) * t)
  return `#${[1, 3, 5].map((i) => part(i).toString(16).padStart(2, '0')).join('')}`
}
