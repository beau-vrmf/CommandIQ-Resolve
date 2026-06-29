// Demo/tutorial scan: point the camera at a room, on-device AI tags a few
// everyday objects (~25%), and the user adds their own tags to the rest — a
// hands-on illustration of how the real Scan app identifies aircraft components.
// Fully local/offline: no Supabase, no auth. Manual tags are session-only.

import { useEffect, useRef, useState } from 'react'
import { Detection } from '../recognition/detector'
import { createObjectDetector } from '../recognition/objectDetector'
import { LabelOverlay } from './LabelOverlay'

interface Props {
  onExit: () => void
}

interface ManualTag {
  id: string
  name: string
  bbox: { x: number; y: number; width: number; height: number }
}

const detector = createObjectDetector()

export function DemoScan({ onExit }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [detections, setDetections] = useState<Detection[]>([])
  const [modelLoading, setModelLoading] = useState(true)
  const [showIntro, setShowIntro] = useState(true)

  // Manual tagging
  const [arming, setArming] = useState(false)
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = useState('')
  const [manualTags, setManualTags] = useState<ManualTag[]>([])

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

  // Poll the on-device detector. The first call lazy-loads the model.
  useEffect(() => {
    if (error) return
    let active = true
    const interval = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      try {
        const result = await detector.detect(video)
        if (active) {
          setDetections(result)
          setModelLoading(false)
        }
      } catch {
        // keep last frame's labels on transient errors
      }
    }, 800)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [error])

  // Place a manual tag where the user tapped (normalized to the frame box).
  function handleFrameClick(e: React.MouseEvent) {
    if (!arming || !frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setPending({ x, y })
    setArming(false)
    setDraft('')
  }

  function commitTag() {
    if (!pending || !draft.trim()) return
    setManualTags((t) => [
      ...t,
      {
        id: crypto.randomUUID(),
        name: draft.trim(),
        bbox: { x: pending.x - 0.02, y: pending.y - 0.02, width: 0.04, height: 0.04 },
      },
    ])
    setPending(null)
    setDraft('')
  }

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
        className={`relative flex-1 overflow-hidden ${arming ? 'cursor-crosshair' : ''}`}
      >
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-center text-rose-200 px-6">
            <div>
              <p className="text-lg font-semibold mb-2">Couldn't open camera</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />

            {/* AI-detected objects (teal) */}
            {detections.map((d, i) => (
              <LabelOverlay key={`ai-${i}`} detection={d} variant="ai" />
            ))}

            {/* User-added tags (blue) */}
            {manualTags.map((t) => (
              <LabelOverlay
                key={t.id}
                detection={{ classLabel: t.name, bbox: t.bbox, confidence: 1 }}
                variant="manual"
              />
            ))}

            {/* Inline name input where the user tapped */}
            {pending && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-1 bg-slate-900/95 border border-blue-400 rounded-lg p-1.5 shadow-lg"
                style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }}
              >
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && commitTag()}
                  placeholder="Name this object"
                  className="px-2 py-1 rounded bg-slate-800 text-white text-xs w-36 focus:outline-none"
                />
                <button onClick={commitTag} className="px-2 py-1 rounded bg-blue-600 text-white text-xs">Add</button>
                <button onClick={() => setPending(null)} className="px-1.5 py-1 rounded text-slate-400 text-xs">✕</button>
              </div>
            )}

            {modelLoading && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 text-teal-200 text-xs px-3 py-1.5 rounded-full">
                Loading on-device AI model…
              </div>
            )}
          </>
        )}

        {/* Intro overlay */}
        {showIntro && !error && (
          <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center p-6">
            <div className="max-w-sm text-center">
              <h2 className="text-white text-lg font-semibold mb-2">Try the Scan concept</h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                Point your camera at the room. The on-device AI will tag a few objects it recognizes
                (in teal). Then tap <span className="text-blue-300 font-medium">+ Add tag</span> to
                label anything it missed — just like identifying aircraft components in the real app.
              </p>
              <button
                onClick={() => setShowIntro(false)}
                className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm"
              >
                Start scanning
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {!error && !showIntro && (
        <div className="px-4 py-3 bg-black/70 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              setArming((a) => !a)
              setPending(null)
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              arming ? 'bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {arming ? 'Tap the object…' : '+ Add tag'}
          </button>
          <span className="text-xs text-slate-400">
            {manualTags.length > 0 ? `${manualTags.length} tag${manualTags.length > 1 ? 's' : ''} added` : 'Teal = AI · Blue = yours'}
          </span>
        </div>
      )}
    </div>
  )
}
