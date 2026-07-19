import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Uriel-Stimme: Push-to-talk (STT) + Vorlesen (TTS) über die browser-native
 * Web Speech API — kostenlos, kein ElevenLabs/Whisper nötig (Phase 1). Chrome
 * unterstützt beides voll; wo nicht verfügbar, bleibt `supported` false und die
 * UI blendet das Mikro aus. Wake-Word/Barge-in kommt erst mit der Hardware.
 */

// Minimale Typen für die (nicht in lib.dom typisierte) Web Speech API.
interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface UrielVoice {
  sttSupported: boolean
  ttsSupported: boolean
  listening: boolean
  /** Startet Push-to-talk; ruft onResult mit dem finalen Transkript. */
  startListening: (onResult: (text: string) => void) => void
  stopListening: () => void
  speak: (text: string) => void
  cancelSpeak: () => void
}

export function useUrielVoice(): UrielVoice {
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const sttSupported = typeof window !== 'undefined' && getRecognitionCtor() !== null
  const ttsSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window

  const stopListening = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const startListening = useCallback(
    (onResult: (text: string) => void) => {
      const Ctor = getRecognitionCtor()
      if (!Ctor) return
      recRef.current?.abort()
      const rec = new Ctor()
      rec.lang = 'de-DE'
      rec.interimResults = false
      rec.continuous = false
      rec.maxAlternatives = 1
      rec.onresult = (e) => {
        const text = e.results?.[0]?.[0]?.transcript?.trim()
        if (text) onResult(text)
      }
      rec.onerror = () => setListening(false)
      rec.onend = () => setListening(false)
      recRef.current = rec
      setListening(true)
      try {
        rec.start()
      } catch {
        setListening(false)
      }
    },
    [],
  )

  const cancelSpeak = useCallback(() => {
    if (ttsSupported) window.speechSynthesis.cancel()
  }, [ttsSupported])

  const speak = useCallback(
    (text: string) => {
      if (!ttsSupported || !text.trim()) return
      window.speechSynthesis.cancel()
      // Markdown grob entfernen, damit die Stimme keine Sternchen vorliest.
      const clean = text
        .replace(/[*_#`>]/g, '')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .trim()
      const u = new SpeechSynthesisUtterance(clean)
      u.lang = 'de-DE'
      u.rate = 1.03
      window.speechSynthesis.speak(u)
    },
    [ttsSupported],
  )

  useEffect(() => {
    return () => {
      recRef.current?.abort()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  return {
    sttSupported,
    ttsSupported,
    listening,
    startListening,
    stopListening,
    speak,
    cancelSpeak,
  }
}
