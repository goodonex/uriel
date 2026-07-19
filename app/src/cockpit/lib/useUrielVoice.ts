import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * Uriel-Stimme (Phase A). Sprechen über ElevenLabs (Edge Function `uriel-voice`,
 * Key serverseitig) statt Browser-Roboterstimme — mit Browser-Fallback, falls
 * die Function/der Key fehlt. Zuhören mit Live-Transkript (interimResults) und
 * Dauer-Zuhören (continuous) + Silence-Timer, damit kein Satz mehr mitten drin
 * abbricht. Web Speech STT braucht Chrome; sonst bleibt `sttSupported` false.
 */

// Minimale Typen für die (nicht in lib.dom typisierte) Web Speech API.
interface SRResult { transcript: string }
interface SRAlternatives extends ArrayLike<SRResult> { isFinal?: boolean }
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SRAlternatives> & { [i: number]: SRAlternatives & { isFinal: boolean } }
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

const SILENCE_MS = 2200 // so lange Stille nach Sprache → Eingabe ist „fertig"

function stripMarkdown(text: string): string {
  return text
    .replace(/[*_#`>]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim()
}

export interface UrielVoice {
  sttSupported: boolean
  ttsSupported: boolean
  listening: boolean
  speaking: boolean
  /** Push-to-talk: onInterim = live mitlaufender Text, onFinal = fertiger Satz. */
  startListening: (onInterim: (text: string) => void, onFinal: (text: string) => void) => void
  stopListening: () => void
  speak: (text: string) => Promise<void>
  cancelSpeak: () => void
}

export function useUrielVoice(): UrielVoice {
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const finalRef = useRef('')
  const onFinalRef = useRef<((t: string) => void) | null>(null)
  const silenceRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const sttSupported = typeof window !== 'undefined' && getRecognitionCtor() !== null
  const ttsSupported = true // ElevenLabs serverseitig + Browser-Fallback → immer eine Stimme

  const clearSilence = () => {
    if (silenceRef.current !== null) {
      window.clearTimeout(silenceRef.current)
      silenceRef.current = null
    }
  }

  const stopListening = useCallback(() => {
    clearSilence()
    recRef.current?.stop()
  }, [])

  const startListening = useCallback(
    (onInterim: (text: string) => void, onFinal: (text: string) => void) => {
      const Ctor = getRecognitionCtor()
      if (!Ctor) return
      recRef.current?.abort()
      clearSilence()
      finalRef.current = ''
      onFinalRef.current = onFinal

      const rec = new Ctor()
      rec.lang = 'de-DE'
      rec.interimResults = true
      rec.continuous = true
      rec.maxAlternatives = 1

      rec.onresult = (e) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          const txt = r[0]?.transcript ?? ''
          if (r.isFinal) finalRef.current += txt
          else interim += txt
        }
        onInterim((finalRef.current + interim).trim())
        // Silence-Timer nach jedem Ergebnis neu setzen → sendet erst bei Ruhe.
        clearSilence()
        silenceRef.current = window.setTimeout(() => recRef.current?.stop(), SILENCE_MS)
      }
      rec.onerror = () => {
        clearSilence()
        setListening(false)
      }
      rec.onend = () => {
        clearSilence()
        setListening(false)
        const text = finalRef.current.trim()
        finalRef.current = ''
        if (text) onFinalRef.current?.(text)
      }

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
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
  }, [])

  const browserSpeak = useCallback((clean: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(clean)
    u.lang = 'de-DE'
    u.rate = 1.03
    u.onend = () => setSpeaking(false)
    window.speechSynthesis.speak(u)
  }, [])

  const speak = useCallback(
    async (text: string) => {
      const clean = stripMarkdown(text)
      if (!clean) return
      cancelSpeak()
      setSpeaking(true)
      try {
        if (!supabase) throw new Error('no supabase')
        const { data, error } = await supabase.functions.invoke('uriel-voice', {
          body: { text: clean },
        })
        if (error || !(data instanceof Blob) || data.size === 0) throw error ?? new Error('no audio')
        const url = URL.createObjectURL(data)
        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = () => {
          setSpeaking(false)
          URL.revokeObjectURL(url)
          if (audioRef.current === audio) audioRef.current = null
        }
        audio.onerror = () => {
          setSpeaking(false)
          URL.revokeObjectURL(url)
        }
        await audio.play()
      } catch {
        // Fallback: Browser-Stimme (bis ElevenLabs-Key gesetzt ist).
        browserSpeak(clean)
      }
    },
    [cancelSpeak, browserSpeak],
  )

  useEffect(() => {
    return () => {
      recRef.current?.abort()
      clearSilence()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      audioRef.current?.pause()
    }
  }, [])

  return { sttSupported, ttsSupported, listening, speaking, startListening, stopListening, speak, cancelSpeak }
}
