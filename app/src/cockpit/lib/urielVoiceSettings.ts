/**
 * Uriel-Stimm-Einstellungen — Kevin wählt Stimme, Modell und Betonung selbst.
 * In localStorage gehalten; useUrielVoice.speak() liest sie frisch pro Ausgabe.
 * Modell = Latenz↔Ausdruck-Regler: flash = schnell, multilingual = ausdrucksstark.
 */
export type UrielModelId = 'eleven_flash_v2_5' | 'eleven_turbo_v2_5' | 'eleven_multilingual_v2'

export interface UrielVoiceSettings {
  voiceId: string
  modelId: UrielModelId
  stability: number // 0..1 — niedriger = lebendigere Betonung, höher = ruhiger/monotoner
  style: number // 0..1 — Ausdruck (wirkt v.a. bei „ausdrucksstark")
  speed: number // 0.7..1.2 — Sprechtempo
}

/** Kuratierte, mehrsprachige Stimmen (funktionieren auf Deutsch). */
export const URIEL_VOICES: { id: string; label: string; note: string }[] = [
  { id: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel', note: 'britisch, autoritär — Jarvis-nah' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', label: 'George', note: 'britisch, warm' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam', note: 'tief, ruhig' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh', note: 'jung, männlich' },
  { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni', note: 'männlich, klar' },
  { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel', note: 'weiblich, ruhig' },
  { id: 'XB0fDUnXU5powFXDhCwa', label: 'Charlotte', note: 'weiblich, weich' },
]

export const URIEL_MODELS: { id: UrielModelId; label: string; note: string }[] = [
  { id: 'eleven_flash_v2_5', label: 'Schnell', note: 'niedrigste Latenz' },
  { id: 'eleven_turbo_v2_5', label: 'Ausgewogen', note: 'Tempo + Qualität' },
  { id: 'eleven_multilingual_v2', label: 'Ausdrucksstark', note: 'beste Betonung, langsamer' },
]

export const URIEL_VOICE_SAMPLE =
  'Alles bereit. Ich bin Uriel — sag mir einfach, was du brauchst.'

const KEY = 'uriel.voice.settings'

const DEFAULTS: UrielVoiceSettings = {
  voiceId: 'onwK4e9ZLuTAKqWW03F9', // Daniel — Jarvis-nah
  modelId: 'eleven_flash_v2_5', // schnell (Kevins Latenz-Wunsch)
  stability: 0.35,
  style: 0.25,
  speed: 1.0,
}

export function loadVoiceSettings(): UrielVoiceSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<UrielVoiceSettings>) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveVoiceSettings(s: UrielVoiceSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* egal */
  }
}
