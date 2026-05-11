import { useCallback, useEffect, useRef, useState } from 'react'

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
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor
    webkitSpeechRecognition?: SRConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

type Options = {
  onFinal: (chunk: string) => void
  lang?: string
}

type Result = {
  isSupported: boolean
  isListening: boolean
  interim: string
  error: string | null
  start: () => void
  stop: () => void
  toggle: () => void
}

export function useSpeechToText({ onFinal, lang = 'en-US' }: Options): Result {
  const Ctor = getCtor()
  const isSupported = !!Ctor
  const [isListening, setIsListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
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
    try { r.stop() } catch { /* best-effort */ }
  }, [])

  const toggle = useCallback(() => {
    if (recRef.current) stop()
    else start()
  }, [start, stop])

  useEffect(() => {
    return () => {
      const r = recRef.current
      if (r) {
        try { r.abort() } catch { /* best-effort */ }
        recRef.current = null
      }
    }
  }, [])

  return { isSupported, isListening, interim, error, start, stop, toggle }
}
