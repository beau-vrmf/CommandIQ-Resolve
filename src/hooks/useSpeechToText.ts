import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal type shims so we don't have to pull in @types/dom-speech-recognition.
type SRConstructor = new () => SpeechRecognitionLike

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

function getCtor(): SRConstructor | null {
  if (typeof window === 'undefined') return null
  // Safari/Chrome use webkit-prefixed variant; standardized name is also accepted.
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor
    webkitSpeechRecognition?: SRConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

type Options = {
  /** Called whenever a final transcript chunk is finalized. */
  onFinal: (chunk: string) => void
  /** BCP-47 language tag, defaults to en-US. */
  lang?: string
}

type Result = {
  /** Whether the browser supports SpeechRecognition at all. */
  isSupported: boolean
  /** Whether we are actively listening right now. */
  isListening: boolean
  /** Live interim text the engine has guessed but not finalized. */
  interim: string
  /** Last error code from the recognition engine, or null. */
  error: string | null
  start: () => void
  stop: () => void
  toggle: () => void
}

/**
 * Web Speech API wrapper for dictation in the note dialog.
 *
 * Online-only (the engine runs in the cloud). Continuous + interim results
 * so the user sees words appear as they're spoken, with finalized chunks
 * fed via the onFinal callback so the consumer can append to a textarea.
 */
export function useSpeechToText({ onFinal, lang = 'en-US' }: Options): Result {
  const Ctor = getCtor()
  const isSupported = !!Ctor
  const [isListening, setIsListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  // Capture latest onFinal to avoid stale closures inside event handlers.
  const onFinalRef = useRef(onFinal)
  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  const start = useCallback(() => {
    if (!Ctor || recRef.current) return
    setError(null)
    setInterim('')
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = lang
    rec.onresult = (e) => {
      let finalChunk = ''
      let interimChunk = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const text = res[0].transcript
        if (res.isFinal) finalChunk += text
        else interimChunk += text
      }
      if (finalChunk) onFinalRef.current(finalChunk)
      setInterim(interimChunk)
    }
    rec.onerror = (e) => {
      setError(e.error)
      setIsListening(false)
      recRef.current = null
    }
    rec.onend = () => {
      setIsListening(false)
      setInterim('')
      recRef.current = null
    }
    try {
      rec.start()
      recRef.current = rec
      setIsListening(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to start')
    }
  }, [Ctor, lang])

  const stop = useCallback(() => {
    const r = recRef.current
    if (!r) return
    try {
      r.stop()
    } catch {
      // best-effort
    }
  }, [])

  const toggle = useCallback(() => {
    if (recRef.current) stop()
    else start()
  }, [start, stop])

  // Stop on unmount.
  useEffect(() => {
    return () => {
      const r = recRef.current
      if (r) {
        try {
          r.abort()
        } catch {
          // best-effort
        }
        recRef.current = null
      }
    }
  }, [])

  return { isSupported, isListening, interim, error, start, stop, toggle }
}
