// Live camera viewing mode (PRD §12.3/§12.4). Reuses the getUserMedia stream
// plumbing from src/components/CameraCapture.tsx, but WITHOUT the still-capture /
// IndexedDB save path — Scan needs the live <video> feed with an overlay layer.
// Detections come from a swappable Detector (guided or CV).

import { useEffect, useRef, useState } from 'react'
import { Detector, Detection } from '../recognition/detector'
import { ScanComponent } from '../db/scan'
import { LabelOverlay } from './LabelOverlay'
import { ComponentCard } from './ComponentCard'

interface Props {
  detector: Detector
  // class_label → component lookup (built from scan_detections + published rows).
  detectionMap: Map<string, ScanComponent>
  onExit: () => void
}

export function CameraScan({ detector, detectionMap, onExit }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detections, setDetections] = useState<Detection[]>([])
  const [selected, setSelected] = useState<ScanComponent | null>(null)

  // Open the rear camera on mount; clean up on unmount. (Mirrors CameraCapture.)
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
        if (name === 'NotAllowedError') {
          setError('Camera permission denied. Enable it in your browser settings and try again.')
        } else if (name === 'NotFoundError') {
          setError('No camera found on this device.')
        } else {
          setError(`Camera error: ${(e as Error).message}`)
        }
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // Poll the detector a few times per second while the feed is live.
  useEffect(() => {
    if (error) return
    let active = true
    const interval = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      try {
        const result = await detector.detect(video)
        if (active) setDetections(result)
      } catch {
        // Detection errors are non-fatal; keep the last frame's labels.
      }
    }, 600)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [detector, error])

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/70 z-10">
        <button
          onClick={onExit}
          className="text-white px-3 py-2 rounded-md hover:bg-white/10"
          aria-label="Exit camera"
        >
          ✕ Exit
        </button>
        <span className="text-white/80 text-sm">Scan · {detector.mode}</span>
        <span className="w-16" />
      </div>

      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-center text-rose-200 px-6">
            <div>
              <p className="text-lg font-semibold mb-2">Couldn't open camera</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Overlay layer — labels positioned over the live feed. */}
            <div className="absolute inset-0">
              {detections.map((d, i) => (
                <LabelOverlay
                  key={`${d.classLabel}-${i}`}
                  detection={d}
                  component={detectionMap.get(d.classLabel)}
                  onSelect={setSelected}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {selected && <ComponentCard component={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
