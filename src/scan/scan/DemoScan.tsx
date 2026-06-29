// Demo/tutorial scan: aim at a room, capture a still, and the on-device AI tags
// a few everyday objects (~25%). On the frozen frame you can tap any tag to view
// it, rename it (e.g. fix a wrong AI guess), or delete it — and add your own tags
// to objects it missed. Capturing a still (rather than tagging live video) keeps
// every tag locked to its object instead of drifting as the camera moves.
// Fully local/offline-capable: no Supabase, no auth. Tags are session-only.

import { useEffect, useRef, useState } from 'react'
import { createObjectDetector } from '../recognition/objectDetector'

interface Props {
  onExit: () => void
}

type TagSource = 'ai' | 'manual'
interface Tag {
  id: string
  name: string
  source: TagSource
  // Normalized to the captured image (0..1), anchored at the object center.
  x: number
  y: number
}

const detector = createObjectDetector()

export function DemoScan({ onExit }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const [error, setError] = useState<string | null>(null)
  const [showIntro, setShowIntro] = useState(true)
  const [busy, setBusy] = useState(false)

  // Captured-frame state
  const [captured, setCaptured] = useState<string | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

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

  // Freeze the current frame and run the detector once on it.
  async function capture() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    setBusy(true)
    try {
      const w = video.videoWidth
      const h = video.videoHeight
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(video, 0, 0, w, h)

      const detections = await detector.detect(video)
      const aiTags: Tag[] = detections.map((d) => ({
        id: crypto.randomUUID(),
        name: d.classLabel,
        source: 'ai',
        x: d.bbox.x + d.bbox.width / 2,
        y: d.bbox.y + d.bbox.height / 2,
      }))

      setTags(aiTags)
      setCaptured(canvas.toDataURL('image/jpeg', 0.85))
    } catch {
      setError('Recognition failed. Try capturing again.')
    } finally {
      setBusy(false)
    }
  }

  function rescan() {
    setCaptured(null)
    setTags([])
    setEditingId(null)
    setAdding(false)
  }

  // Add a manual tag where the user tapped the frozen image.
  function handleFrameClick(e: React.MouseEvent) {
    if (!adding || !frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    const id = crypto.randomUUID()
    setTags((t) => [
      ...t,
      {
        id,
        name: '',
        source: 'manual',
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      },
    ])
    setAdding(false)
    setEditingId(id) // open editor immediately so they can name it
  }

  function rename(id: string, name: string) {
    setTags((t) => t.map((tag) => (tag.id === id ? { ...tag, name } : tag)))
  }

  function remove(id: string) {
    setTags((t) => t.filter((tag) => tag.id !== id))
    setEditingId(null)
  }

  const editing = tags.find((t) => t.id === editingId) || null

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/70 z-20">
        <button onClick={onExit} className="text-white px-3 py-2 rounded-md hover:bg-white/10" aria-label="Exit demo">
          ✕ Exit
        </button>
        <span className="text-white/80 text-sm">Demo · {detector.mode}</span>
        <span className="w-16" />
      </div>

      <div
        ref={frameRef}
        onClick={handleFrameClick}
        className={`relative flex-1 overflow-hidden flex items-center justify-center ${adding ? 'cursor-crosshair' : ''}`}
      >
        {error ? (
          <div className="text-center text-rose-200 px-6">
            <p className="text-lg font-semibold mb-2">Couldn't open camera</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <>
            {/* Live camera (hidden once a frame is captured) */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`max-h-full max-w-full object-contain ${captured ? 'hidden' : ''}`}
            />
            {/* Frozen frame for tagging */}
            {captured && (
              <img src={captured} alt="Captured frame" className="max-h-full max-w-full object-contain select-none" />
            )}

            {/* Tags (only on the frozen frame). Tap to view / rename / delete. */}
            {captured &&
              tags.map((t) => (
                <button
                  key={t.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingId(t.id)
                  }}
                  style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 max-w-[45vw] px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap shadow-lg cursor-pointer ${
                    t.source === 'ai'
                      ? 'bg-teal-600/90 border-teal-300 text-white hover:bg-teal-500'
                      : 'bg-blue-600/90 border-blue-300 text-white hover:bg-blue-500'
                  }`}
                >
                  {t.name || 'Untitled'} <span className="opacity-80">✎</span>
                </button>
              ))}

            {/* Tag editor popover */}
            {editing && (
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

            {busy && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 text-teal-200 text-xs px-3 py-1.5 rounded-full">
                Loading AI model / recognizing…
              </div>
            )}

            {/* Intro overlay */}
            {showIntro && (
              <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center p-6">
                <div className="max-w-sm text-center">
                  <h2 className="text-white text-lg font-semibold mb-2">Try the Scan concept</h2>
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">
                    Aim at the room and tap <span className="text-teal-300 font-medium">Capture</span>.
                    The on-device AI tags a few objects it recognizes (teal). Then tap any tag to
                    rename or remove it, or use <span className="text-blue-300 font-medium">+ Add tag</span>
                    {' '}to label what it missed — just like identifying aircraft components in the real app.
                  </p>
                  <button
                    onClick={() => setShowIntro(false)}
                    className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm"
                  >
                    Got it
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
          {!captured ? (
            <button
              onClick={capture}
              disabled={busy}
              className="px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-medium text-sm"
            >
              {busy ? 'Recognizing…' : '◉ Capture'}
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
              <button onClick={rescan} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium">
                ↻ Rescan
              </button>
              <span className="text-xs text-slate-400">Teal = AI · Blue = yours · tap to edit</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
