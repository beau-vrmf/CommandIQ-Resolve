// OCR still-image scan — the practical component-recognition path.
//
// Aim, Capture a still, read the printed text on-device (tesseract), and match it
// to the published catalog. Matched components appear as tags anchored to their
// placard text; tap one to open its card. Reading text (rather than guessing an
// object class) avoids misidentification and works for plain-box components.
//
// Still-image only — live AR is the same recognition run on video frames, later.

import { useEffect, useRef, useState } from 'react'
import { ScanComponent, getCatalog } from '../db/scan'
import { recognizeText, matchCatalog, OcrMatch } from '../ocr/ocr'
import { ComponentCard } from './ComponentCard'

interface Props {
  onExit: () => void
}

export function OcrScan({ onExit }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [frozen, setFrozen] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [matches, setMatches] = useState<OcrMatch[]>([])
  const [readNothing, setReadNothing] = useState(false)
  const [selected, setSelected] = useState<ScanComponent | null>(null)

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

  async function capture() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    setReading(true)
    setReadNothing(false)
    setMatches([])
    try {
      const w = video.videoWidth
      const h = video.videoHeight
      // Upscale a little for sharper text — improves OCR (mirrors PdfImport).
      const scale = Math.min(2, 1600 / Math.max(w, h)) || 1
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
      setFrozen(canvas.toDataURL('image/jpeg', 0.9))

      const [words, catalog] = await Promise.all([recognizeText(canvas), getCatalog()])
      const found = matchCatalog(words, catalog)
      setMatches(found)
      setReadNothing(found.length === 0)
    } catch {
      setError('Reading failed. Try capturing again.')
    } finally {
      setReading(false)
    }
  }

  function retake() {
    setFrozen(null)
    setMatches([])
    setReadNothing(false)
    setSelected(null)
  }

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/70 z-20">
        <button onClick={onExit} className="text-white px-3 py-2 rounded-md hover:bg-white/10" aria-label="Exit">
          ✕ Exit
        </button>
        <span className="text-white/80 text-sm">Scan a placard · OCR</span>
        <span className="w-16" />
      </div>

      <div className="relative flex-1 overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="text-center text-rose-200 px-6">
            <p className="text-lg font-semibold mb-2">Couldn't open camera</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <div className="relative inline-block">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`block max-h-[80vh] max-w-full ${frozen ? 'hidden' : ''}`}
            />
            {frozen && <img src={frozen} alt="Captured frame" className="block max-h-[80vh] max-w-full select-none" />}

            {/* Matched component tags anchored to their placard text */}
            {frozen &&
              matches.map((m) => (
                <button
                  key={m.component.id}
                  onClick={() => setSelected(m.component)}
                  style={{
                    left: `${(m.bbox.x + m.bbox.width / 2) * 100}%`,
                    top: `${(m.bbox.y + m.bbox.height / 2) * 100}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 max-w-[45vw] px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap shadow-lg bg-emerald-600/90 border-emerald-300 text-white hover:bg-emerald-500 cursor-pointer"
                >
                  {m.component.name} <span className="opacity-80">ⓘ</span>
                </button>
              ))}

            {reading && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 text-emerald-200 text-xs px-3 py-1.5 rounded-full">
                Reading text…
              </div>
            )}
            {readNothing && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-amber-200 text-xs px-3 py-1.5 rounded-full text-center max-w-[80%]">
                No catalog matches found. Get closer to the placard, steady the shot, and retake.
              </div>
            )}
          </div>
        )}
      </div>

      {!error && (
        <div className="px-4 py-3 bg-black/70 flex items-center justify-center gap-3">
          {!frozen ? (
            <button onClick={capture} disabled={reading} className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm">
              ◉ Capture &amp; read
            </button>
          ) : (
            <>
              <button onClick={retake} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium">
                ↻ Retake
              </button>
              <span className="text-xs text-slate-400">
                {matches.length > 0 ? `${matches.length} match${matches.length > 1 ? 'es' : ''} — tap a tag` : reading ? '' : 'Tap retake to try again'}
              </span>
            </>
          )}
        </div>
      )}

      {selected && <ComponentCard component={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
