import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { loadVoiceSettings } from './urielVoiceSettings'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// Winziges stilles WAV — spielt bei der ersten Nutzer-Geste auf DEM Audio-Element,
// das wir wiederverwenden. Danach erlaubt der Browser spätere play()-Aufrufe auf
// genau diesem Element (löst die Autoplay-Sperre nach dem async Denk-Vorgang).
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQgAAAAAAAAAAAAAAA=='

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
  /** Letzter Stimm-Fehler (ElevenLabs), damit ein Fallback nicht stumm bleibt. */
  voiceError: string | null
  /** Bei einer Nutzer-Geste aufrufen → schaltet Audio-Wiedergabe frei. */
  unlock: () => void
  /** Push-to-talk: onInterim = live mitlaufender Text, onFinal = fertiger Satz. */
  startListening: (onInterim: (text: string) => void, onFinal: (text: string) => void) => void
  stopListening: () => void
  speak: (text: string) => Promise<void>
  cancelSpeak: () => void
}

export function useUrielVoice(): UrielVoice {
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const finalRef = useRef('')
  const onFinalRef = useRef<((t: string) => void) | null>(null)
  const silenceRef = useRef<number | null>(null)
  const playerRef = useRef<HTMLAudioElement | null>(null)
  const unlockedRef = useRef(false)
  const urlRef = useRef<string | null>(null)

  const getPlayer = () => {
    if (!playerRef.current) playerRef.current = new Audio()
    return playerRef.current
  }

  // Bei der ersten Nutzer-Geste aufrufen: „segnet" das Audio-Element, damit Uriel
  // später (nach dem Denken) sprechen darf, ohne dass der Browser blockt.
  const unlock = useCallback(() => {
    if (unlockedRef.current) return
    const p = getPlayer()
    try {
      p.src = SILENT_WAV
      const r = p.play()
      if (r && typeof r.then === 'function') {
        r.then(() => { p.pause(); p.currentTime = 0 }).catch(() => {})
      }
      unlockedRef.current = true
    } catch { /* egal */ }
  }, [])

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
    const p = playerRef.current
    if (p) {
      p.pause()
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
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
        // WICHTIG: supabase.functions.invoke liest audio/mpeg fälschlich als Text
        // (nur application/octet-stream → Blob) und zerstört die Binärdaten.
        // Darum direkter fetch mit dem Session-Token → sauberes Audio-Blob.
        const { data: sess } = await supabase.auth.getSession()
        const token = sess.session?.access_token
        if (!token) throw new Error('no session')
        const vs = loadVoiceSettings()
        const res = await fetch(`${SUPABASE_URL}/functions/v1/uriel-voice`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            text: clean,
            voiceId: vs.voiceId,
            modelId: vs.modelId,
            voiceSettings: { stability: vs.stability, style: vs.style, speed: vs.speed },
          }),
        })
        if (!res.ok) {
          let detail = `${res.status}`
          try {
            const j = await res.json()
            if (j?.message) detail = j.message
          } catch { /* kein JSON-Body */ }
          throw new Error(`ElevenLabs: ${detail}`)
        }
        const blob = await res.blob()
        if (blob.size === 0) throw new Error('leeres Audio')
        setVoiceError(null)
        const url = URL.createObjectURL(blob)
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = url
        // Dasselbe (bei der Geste freigeschaltete) Element wiederverwenden.
        const p = getPlayer()
        p.src = url
        p.onended = () => {
          setSpeaking(false)
          if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
        }
        p.onerror = () => setSpeaking(false)
        await p.play()
      } catch (e) {
        // Fallback: Browser-Stimme — aber Fehler sichtbar machen (nicht stumm).
        const msg = e instanceof Error ? e.message : 'Stimme fehlgeschlagen'
        setVoiceError(msg)
        console.warn('[Uriel-Stimme] Fallback auf Browser:', msg)
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
      playerRef.current?.pause()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  return { sttSupported, ttsSupported, listening, speaking, voiceError, unlock, startListening, stopListening, speak, cancelSpeak }
}
