// Saves the picture. The PNG is the SVG drawn onto a canvas, so what you save
// is what you saw.

import { POSTER } from '../core/layout.js'

export async function svgToPng(svg) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = POSTER.width
    canvas.height = POSTER.height
    canvas.getContext('2d').drawImage(image, 0, 0, POSTER.width, POSTER.height)
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png failed'))), 'image/png'))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
