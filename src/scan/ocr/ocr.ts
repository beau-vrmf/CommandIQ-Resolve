// On-device OCR for component recognition. Reads printed text (placards, part
// numbers, data plates) from a captured still and matches it to the component
// catalog — far more reliable for labeled aircraft parts than guessing an object
// class from shape. Reuses the tesseract.js pattern from ojt/admin/PdfImport.tsx
// (lazy-loaded, runs locally — images never leave the device).

import { ScanComponent } from '../db/scan'

// A word read from the image, with a normalized (0..1) bounding box.
export interface OcrWord {
  text: string
  bbox: { x: number; y: number; width: number; height: number }
}

export interface OcrMatch {
  component: ScanComponent
  bbox: { x: number; y: number; width: number; height: number }
}

// Uppercase, strip punctuation, collapse whitespace.
function norm(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Levenshtein distance (small inputs), for tolerating OCR character errors.
function lev(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    }
  }
  return d[m][n]
}

// One token ~matches another (exact for short tokens; allow 1 edit for longer).
function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.min(a.length, b.length) >= 4 && Math.abs(a.length - b.length) <= 1) {
    return lev(a, b) <= 1
  }
  return false
}

// Run OCR on a captured canvas and return words with normalized boxes.
export async function recognizeText(canvas: HTMLCanvasElement): Promise<OcrWord[]> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1)
  try {
    const { data } = await worker.recognize(canvas)
    const w = canvas.width || 1
    const h = canvas.height || 1
    // tesseract returns word boxes as {x0,y0,x1,y1} in pixels.
    const words = (data as { words?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> }).words ?? []
    return words
      .filter((wd) => wd.text && wd.text.trim())
      .map((wd) => ({
        text: wd.text,
        bbox: {
          x: wd.bbox.x0 / w,
          y: wd.bbox.y0 / h,
          width: (wd.bbox.x1 - wd.bbox.x0) / w,
          height: (wd.bbox.y1 - wd.bbox.y0) / h,
        },
      }))
  } finally {
    await worker.terminate()
  }
}

// Match read words to catalog components. Each component is matched on its
// ocr_terms (preferred), then name / alternate_names / part_number. A multi-word
// term matches if all its tokens appear among the read words; the tag anchors to
// the first matching token's box. One tag per component.
export function matchCatalog(words: OcrWord[], components: ScanComponent[]): OcrMatch[] {
  const normWords = words.map((w) => ({ token: norm(w.text), bbox: w.bbox })).filter((w) => w.token)
  const matches: OcrMatch[] = []

  for (const c of components) {
    const terms = [
      ...(c.ocr_terms ?? []),
      c.name,
      ...(c.alternate_names ?? []),
      ...(c.part_number ? [c.part_number] : []),
    ]
      .map(norm)
      .filter(Boolean)

    let anchor: OcrWord['bbox'] | null = null
    for (const term of terms) {
      const tokens = term.split(' ')
      // Find a read word matching the term's first token to use as the anchor.
      const first = normWords.find((w) => tokenMatch(w.token, tokens[0]))
      if (!first) continue
      // Every term token must appear somewhere among the read words.
      const allPresent = tokens.every((tok) => normWords.some((w) => tokenMatch(w.token, tok)))
      if (allPresent) {
        anchor = first.bbox
        break
      }
    }
    if (anchor) matches.push({ component: c, bbox: anchor })
  }

  return matches
}
