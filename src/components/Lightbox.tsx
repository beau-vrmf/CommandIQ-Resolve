import { useEffect, useState } from 'react'
import type { BBox } from '../data/fi-tree'

export type VisitedBlock = {
  blockId: string
  blockNumber: string
  sheet: string
  answer: 'yes' | 'no' | null
  hasNote: boolean
  note?: string
  bbox?: BBox
}

type Props = {
  src: string
  alt: string
  open: boolean
  onClose: () => void
  visitedBlocks?: VisitedBlock[] // blocks on current sheet only → SVG highlights
  sessionNotes?: VisitedBlock[]  // all answered steps → notes panel
}

/**
 * Fullscreen image viewer with pinch-to-zoom (native via touch-action) and
 * tap-to-toggle 1x/2x. Closes on backdrop tap, X button, or Escape.
 * Falls back gracefully if the image is missing — shows a placeholder card
 * instead of a broken icon, so blocks without an authored sheet image don't
 * confuse the technician.
 *
 * When visitedBlocks are provided, an SVG overlay renders green highlight
 * rectangles over the block number labels the technician has already answered.
 * When sessionNotes are provided, a collapsible notes panel lists all steps.
 */
export function Lightbox({ src, alt, open, onClose, visitedBlocks, sessionNotes }: Props) {
  const [zoomed, setZoomed] = useState(false)
  const [errored, setErrored] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setZoomed(false)
    setErrored(false)
    setNotesOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const displayedNotes = sessionNotes?.filter((n) => n.sheet !== 'cross-sheet') ?? []
  const noteCount = displayedNotes.filter((n) => n.hasNote).length

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 bg-black/60">
        <span className="text-sm text-slate-300 truncate">{alt}</span>
        <div className="flex items-center gap-2">
          {displayedNotes.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setNotesOpen((o) => !o)
              }}
              className={`text-sm px-3 py-1 rounded hover:bg-white/10 flex items-center gap-1 ${
                notesOpen ? 'text-emerald-400' : 'text-slate-300'
              }`}
              aria-expanded={notesOpen}
              aria-label={notesOpen ? 'Hide session notes' : 'Show session notes'}
            >
              ✎ Notes{noteCount > 0 ? ` (${noteCount})` : ''}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="text-white text-xl px-3 py-1 rounded hover:bg-white/10"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Collapsible notes panel */}
      {notesOpen && displayedNotes.length > 0 && (
        <div
          className="bg-slate-900/95 border-t border-slate-700 px-4 py-3 max-h-64 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2 font-semibold">
            Session steps
          </p>
          <ol className="space-y-2">
            {displayedNotes.map((entry) => (
              <li key={entry.blockId} className="flex gap-3 items-start text-sm">
                <span
                  className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-xs font-bold uppercase ${
                    entry.answer === 'yes'
                      ? 'bg-emerald-800 text-emerald-200'
                      : entry.answer === 'no'
                        ? 'bg-rose-800 text-rose-200'
                        : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {entry.answer ?? '—'}
                </span>
                <span className="shrink-0 text-slate-400 font-mono">
                  Sht {entry.sheet} Blk {entry.blockNumber}
                </span>
                {entry.hasNote ? (
                  <span className="text-slate-200 italic">{entry.note}</span>
                ) : (
                  <span className="text-slate-600 italic">no note</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Image scroll area */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center p-2"
        style={{ touchAction: 'pinch-zoom' }}
        onClick={(e) => e.stopPropagation()}
      >
        {errored ? (
          <div className="max-w-md text-center bg-slate-800 border border-slate-600 rounded-lg p-6 text-slate-200">
            <p className="text-lg font-semibold mb-2">Source image not yet bundled</p>
            <p className="text-sm text-slate-400">
              The TO source page for this block hasn't been added to the app yet.
              Reference the original Technical Order until the image is bundled.
            </p>
            <p className="text-xs text-slate-500 mt-3 font-mono">{src}</p>
          </div>
        ) : (
          // Wrapper is relative so the SVG overlay can be absolutely positioned
          // over the image. CSS scale() on the img transforms the entire wrapper,
          // keeping highlights aligned at any zoom level.
          <div className="relative inline-block">
            <img
              src={src}
              alt={alt}
              onError={() => setErrored(true)}
              onClick={() => setZoomed((z) => !z)}
              className={`block max-w-none transition-transform duration-150 select-none ${
                zoomed ? 'scale-200 cursor-zoom-out' : 'cursor-zoom-in'
              }`}
              style={{
                maxHeight: zoomed ? 'none' : '90vh',
                maxWidth: zoomed ? 'none' : '95vw',
              }}
              draggable={false}
            />
            {/* SVG highlight overlay — viewBox 0 0 1 1 so bbox fractions map
                directly to SVG coordinates with no runtime math */}
            {visitedBlocks && visitedBlocks.some((vb) => vb.bbox) && (
              <svg
                aria-hidden
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
              >
                {visitedBlocks.map((vb) =>
                  vb.bbox ? (
                    <rect
                      key={vb.blockId}
                      x={vb.bbox.x}
                      y={vb.bbox.y}
                      width={vb.bbox.w}
                      height={vb.bbox.h}
                      fill="rgba(34,197,94,0.35)"
                      stroke="rgba(34,197,94,0.85)"
                      strokeWidth="0.003"
                    />
                  ) : null
                )}
              </svg>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
