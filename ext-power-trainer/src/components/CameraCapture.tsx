import { useEffect, useRef, useState } from 'react'
import { savePhoto } from '../db/sessions'

type Props = {
  onCaptured: (photoId: string) => void
}

export function CameraCapture({ onCaptured }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium"
        aria-label="Capture photo"
      >
        📷 Photo
      </button>
      {open && (
        <CameraDialog
          onClose={() => setOpen(false)}
          onConfirm={(id) => { onCaptured(id); setOpen(false) }}
        />
      )}
    </>
  )
}

type DialogProps = {
  onClose: () => void
  onConfirm: (photoId: string) => void
}

function CameraDialog({ onClose, onConfirm }: DialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (e) {
        const name = (e as Error).name
        if (name === 'NotAllowedError') setError('Camera permission denied.')
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

  useEffect(() => {
    return () => { if (capturedUrl) URL.revokeObjectURL(capturedUrl) }
  }, [capturedUrl])

  async function takePhoto() {
    const video = videoRef.current
    if (!video) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    canvas.getContext('2d')!.drawImage(video, 0, 0, w, h)
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85),
    )
    if (!blob) return
    setCapturedBlob(blob)
    setCapturedUrl(URL.createObjectURL(blob))
  }

  function retake() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedBlob(null); setCapturedUrl(null)
  }

  async function confirm() {
    if (!capturedBlob) return
    setSaving(true)
    try {
      const id = await savePhoto(capturedBlob)
      onConfirm(id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/70">
        <button onClick={onClose} className="text-white px-3 py-2 rounded-md hover:bg-white/10" aria-label="Close camera">
          ✕ Close
        </button>
        <span className="text-white/80 text-sm">{capturedBlob ? 'Review' : 'Camera'}</span>
        <span className="w-16" />
      </div>
      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
        {error ? (
          <div className="text-center text-rose-200 px-6">
            <p className="text-lg font-semibold mb-2">Couldn't open camera</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : capturedUrl ? (
          <img src={capturedUrl} alt="Captured photo preview" className="max-h-full max-w-full object-contain" />
        ) : (
          <video ref={videoRef} autoPlay muted playsInline className="max-h-full max-w-full object-contain" />
        )}
      </div>
      <div className="px-4 py-5 bg-black/70 flex items-center justify-center gap-4">
        {error ? (
          <button onClick={onClose} className="px-6 py-3 rounded-lg bg-slate-700 text-white">Close</button>
        ) : capturedBlob ? (
          <>
            <button onClick={retake} className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium">↻ Retake</button>
            <button onClick={confirm} disabled={saving} className="px-8 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold">
              {saving ? 'Saving…' : '✓ Use photo'}
            </button>
          </>
        ) : (
          <button onClick={takePhoto} aria-label="Take photo" className="w-20 h-20 rounded-full bg-white border-4 border-white/40 active:scale-95 transition-transform" />
        )}
      </div>
    </div>
  )
}
