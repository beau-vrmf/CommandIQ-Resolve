// Demo/tutorial scan — live room scanning.
//
// As you scan, the on-device AI recognizes objects and labels them live (teal);
// the labels follow their objects because we re-detect each tick and match
// detections to persistent "tracks" (a lightweight centroid tracker).
//
// "Capture" freezes the frame so you can ADD or EDIT tags precisely. A manual
// tag (blue) anchors to the object under your finger and then follows that
// object once you resume scanning. Objects the AI can't detect at all have
// nothing to anchor to, so those tags can't track (stated limitation).
//
// Fully local: no Supabase, no auth. Tags are session-only.

import { useEffect, useRef, useState } from 'react'
import { Detection } from '../recognition/detector'
import { createObjectDetector } from '../recognition/objectDetector'

interface Props {
  onExit: () => void
}

// A detected object given a stable id across frames.
interface Track {
  id: string
  cls: string
  cx: number
  cy: number
  missed: number
}

interface ManualTag {
  id: string
  name: string
  trackId: string | null // anchored object; null = unanchored (can't follow)
  x: number // last known center (fallback when the track is lost)
  y: number
}

const detector = createObjectDetector()
const MATCH_DIST = 0.1 // normalized centroid distance to consider "same object"
const MAX_MISS = 8 // ticks a track survives unseen before being dropped
const ANCHOR_DIST = 0.15 // how close a tap must be to a track to anchor

// Match new detections to existing tracks by class + nearest centroid.
function updateTracks(prev: Track[], dets: Detection[]): Track[] {
  const next: Track[] = []
  const used = new Set<string>()
  for (const d of dets) {
    const cx = d.bbox.x + d.bbox.width / 2
    const cy = d.bbox.y + d.bbox.height / 2
    let best: Track | null = null
    let bestDist = MATCH_DIST
    for (const t of prev) {
      if (used.has(t.id) || t.cls !== d.classLabel) continue
      const dist = Math.hypot(t.cx - cx, t.cy - cy)
      if (dist < bestDist) {
        bestDist = dist
        best = t
      }
    }
    if (best) {
      used.add(best.id)
      next.push({ ...best, cx, cy, missed: 0 })
    } else {
      next.push({ id: crypto.randomUUID(), cls: d.classLabel, cx, cy, missed: 0 })
    }
  }
  // Keep recently-unseen tracks briefly so a one-frame miss doesn't drop a tag.
  for (const t of prev) {
    if (!used.has(t.id) && t.missed < MAX_MISS) next.push({ ...t, missed: t.missed + 1 })
  }
  return next
}

export function DemoScan({ onExit }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tracksRef = useRef<Track[]>([])

  const [error, setError] = useState<string | null>(null)
  const [showIntro, setShowIntro] = useState(true)
  const [loadingModel, setLoadingModel] = useState(true)

  const [tracks, setTracks] = useState<Track[]>([])
  const [manualTags, setManualTags] = useState<ManualTag[]>([])

  const [frozen, setFrozen] = useState<string | null>(null) // dataURL when paused
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Open the rear camera (same plumbing as CameraScan).
  useEffect(() => {
    let cancelled = false
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera API not available in this browser.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (e) {
        const name = (e as Error).name
        if (name === 'NotAllowedError') setError('Camera permission denied. Enable it and try again.')
        else if (name === 'NotFoundError') setError('No camera found on this device.')
        else setError(`Camera error: ${(e as Error).message}`)
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // Live detection loop (paused while frozen). Updates tracks + manual tag positions.
  useEffect(() => {
    if (error || showIntro || frozen) return
    let active = true
    const interval = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      try {
        const dets = await detector.detect(video)
        if (!active) return
        const next = updateTracks(tracksRef.current, dets)
        tracksRef.current = next
        setTracks(next)
        setManualTags((prev) =>
          prev.map((m) => {
            if (!m.trackId) return m
            const t = next.find((t) => t.id === m.trackId)
            return t ? { ...m, x: t.cx, y: t.cy } : m
          }),
        )
        setLoadingModel(false)
      } catch {
        // transient errors: keep last positions
      }
    }, 350)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [error, showIntro, frozen])

  // Capture: freeze the frame for adding/editing tags.
  function capture() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    const w = video.videoWidth
    const h = video.videoHeight
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(video, 0, 0, w, h)
    setFrozen(canvas.toDataURL('image/jpeg', 0.85))
    setAdding(false)
    setEditingId(null)
  }

  function resume() {
    setFrozen(null)
    setAdding(false)
    setEditingId(null)
  }

  // In frozen mode: tap an object to drop a manual tag anchored to it.
  function handleAddClick(e: React.MouseEvent) {
    if (!adding || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height

    // Anchor to the nearest tracked object within range, else leave unanchored.
    let best: Track | null = null
    let bestDist = ANCHOR_DIST
    for (const t of tracksRef.current) {
      const dist = Math.hypot(t.cx - nx, t.cy - ny)
      if (dist < bestDist) {
        bestDist = dist
        best = t
      }
    }
    const id = crypto.randomUUID()
    setManualTags((m) => [
      ...m,
      { id, name: '', trackId: best?.id ?? null, x: best?.cx ?? nx, y: best?.cy ?? ny },
    ])
    setAdding(false)
    setEditingId(id)
  }

  // Tap a tag (frozen mode): edit existing manual tag, or promote an AI label.
  function tapTag(track: Track | null, manual: ManualTag | null) {
    if (manual) {
      setEditingId(manual.id)
      return
    }
    if (track) {
      const id = crypto.randomUUID()
      setManualTags((m) => [...m, { id, name: track.cls, trackId: track.id, x: track.cx, y: track.cy }])
      setEditingId(id)
    }
  }

  function rename(id: string, name: string) {
    setManualTags((m) => m.map((t) => (t.id === id ? { ...t, name } : t)))
  }
  function remove(id: string) {
    setManualTags((m) => m.filter((t) => t.id !== id))
    setEditingId(null)
  }

  const manualByTrack = new Map(manualTags.filter((m) => m.trackId).map((m) => [m.trackId!, m]))
  const editing = manualTags.find((m) => m.id === editingId) || null

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/70 z-20">
        <button onClick={onExit} className="text-white px-3 py-2 rounded-md hover:bg-white/10" aria-label="Exit demo">
          ✕ Exit
        </button>
        <span className="text-white/80 text-sm">Demo · {frozen ? 'Editing' : 'Scanning'}</span>
        <span className="w-16" />
      </div>

      <div className="relative flex-1 overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="text-center text-rose-200 px-6">
            <p className="text-lg font-semibold mb-2">Couldn't open camera</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <>
            {/* Media box — wrapper sizes to the media so tag % coords align. */}
            <div
              ref={wrapRef}
              onClick={handleAddClick}
              className={`relative inline-block ${adding ? 'cursor-crosshair' : ''}`}
            >
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`block max-h-[78vh] max-w-full ${frozen ? 'hidden' : ''}`}
              />
              {frozen && <img src={frozen} alt="Captured frame" className="block max-h-[78vh] max-w-full select-none" />}

              {/* Tags: AI (teal) for tracks without a manual tag, manual (blue) otherwise */}
              {tracks.map((t) => {
                const m = manualByTrack.get(t.id)
                const interactive = !!frozen
                return (
                  <button
                    key={t.id}
                    disabled={!interactive}
                    onClick={(e) => {
                      e.stopPropagation()
                      tapTag(t, m ?? null)
                    }}
                    style={{ left: `${t.cx * 100}%`, top: `${t.cy * 100}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 max-w-[45vw] px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap shadow-lg ${
                      m
                        ? 'bg-blue-600/90 border-blue-300 text-white'
                        : 'bg-teal-600/90 border-teal-300 text-white'
                    } ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {m ? m.name || 'Untitled' : t.cls}
                    {interactive && <span className="ml-1 opacity-80">✎</span>}
                  </button>
                )
              })}

              {/* Unanchored manual tags (no track to follow) */}
              {manualTags
                .filter((m) => !m.trackId || !tracks.find((t) => t.id === m.trackId))
                .map((m) => (
                  <button
                    key={m.id}
                    disabled={!frozen}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingId(m.id)
                    }}
                    style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 max-w-[45vw] px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap shadow-lg bg-blue-600/70 border-blue-300/70 text-white ${
                      frozen ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    {m.name || 'Untitled'}
                  </button>
                ))}

              {/* Editor popover */}
              {editing && frozen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute -translate-x-1/2 z-30 flex items-center gap-1 bg-slate-900/95 border border-slate-500 rounded-lg p-1.5 shadow-lg"
                  style={{ left: `${editing.x * 100}%`, top: `calc(${editing.y * 100}% + 18px)` }}
                >
                  <input
                    autoFocus
                    value={editing.name}
                    onChange={(e) => rename(editing.id, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                    placeholder="Name this object"
                    className="px-2 py-1 rounded bg-slate-800 text-white text-xs w-36 focus:outline-none"
                  />
                  <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs">Done</button>
                  <button onClick={() => remove(editing.id)} className="px-1.5 py-1 rounded text-rose-300 text-xs" aria-label="Delete tag">🗑</button>
                </div>
              )}
            </div>

            {loadingModel && !frozen && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 text-teal-200 text-xs px-3 py-1.5 rounded-full">
                Loading AI model…
              </div>
            )}

            {/* Intro overlay */}
            {showIntro && (
              <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center p-6">
                <div className="max-w-sm text-center">
                  <h2 className="text-white text-lg font-semibold mb-2">Try the Scan concept</h2>
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">
                    Scan the room — the on-device AI labels objects it recognizes (teal) and the
                    labels follow them. Tap <span className="text-teal-300 font-medium">Capture</span>
                    {' '}to pause and add or rename tags; a tag you add (blue) sticks to its object
                    when you keep scanning — just like aircraft components in the real app.
                  </p>
                  <button onClick={() => setShowIntro(false)} className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm">
                    Start scanning
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom controls */}
      {!error && !showIntro && (
        <div className="px-4 py-3 bg-black/70 flex items-center justify-center gap-3">
          {!frozen ? (
            <button onClick={capture} className="px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm">
              ◉ Capture to add / edit tags
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setAdding((a) => !a)
                  setEditingId(null)
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${adding ? 'bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
              >
                {adding ? 'Tap the object…' : '+ Add tag'}
              </button>
              <button onClick={resume} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium">
                ✓ Resume scanning
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
