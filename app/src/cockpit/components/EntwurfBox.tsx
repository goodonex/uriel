import type { CSSProperties } from 'react'
import type { PostenEntwurf } from '../lib/prioritaet'
import {
  entwurfStand,
  entwurfZeitAnzeige,
  FENSTER_AUSWAHL,
  fensterWert,
  slotTagText,
  slotVerschieben,
  ZEIT_WARNUNG,
  type Slot,
} from '../lib/entwurfZeitangaben'

/**
 * Der Entwurf am Posten — eine Fassung für Arbeitsliste und Arbeitsmodus
 * (06.10.2026).
 *
 * Neu daran: Die Terminvorschläge im Entwurf sind Felder, keine Wörter. Kevin
 * kann jeden Vorschlag um einen Werktag verschieben oder das Fenster wechseln,
 * der Satz darüber rechnet sich sofort neu, und „Kopieren" nimmt genau diesen
 * Text (`versandText` mit denselben `aenderungen`). Gespeichert wird die
 * Verschiebung nicht — sie gilt für den Text, der jetzt rausgeht.
 */
export function EntwurfBox({
  entwurf,
  aenderungen,
  onAenderungen,
  textStil,
  jetzt = new Date(),
}: {
  entwurf: PostenEntwurf
  aenderungen?: ReadonlyArray<Slot | null | undefined>
  onAenderungen?: (naechste: (Slot | null)[]) => void
  textStil?: CSSProperties
  jetzt?: Date
}) {
  const anzeige = entwurf.roh
    ? entwurfZeitAnzeige(entwurf.roh, entwurf.erstelltAm, jetzt, aenderungen)
    : { text: entwurf.text, slots: [], zeitVeraltet: Boolean(entwurf.zeitVeraltet) }

  const setze = (i: number, slot: Slot) => {
    const naechste = anzeige.slots.map((s, j) => (j === i ? slot : (aenderungen?.[j] ?? s.slot ?? null)))
    onAenderungen?.(naechste)
  }

  return (
    <div
      style={{
        border: '1px solid var(--ck-border-strong)',
        borderRadius: 'var(--ck-radius-innen)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span className="ck-label" style={{ color: 'var(--ck-accent)' }}>
          Entwurf
        </span>
        <span style={{ fontSize: 11, color: 'var(--ck-text-3)' }}>{entwurfStand(entwurf.erstelltAm, jetzt)}</span>
      </div>
      {entwurf.veraltet ? (
        <span style={{ fontSize: 12, color: 'var(--ck-warn)' }}>
          Der Lead hat danach nochmal geschrieben — vor dem Senden gegenlesen.
        </span>
      ) : null}
      {anzeige.zeitVeraltet ? <span style={{ fontSize: 12, color: 'var(--ck-warn)' }}>{ZEIT_WARNUNG}</span> : null}
      <div style={{ whiteSpace: 'pre-wrap', color: 'var(--ck-text-1)', ...textStil }}>{anzeige.text}</div>

      {anzeige.slots.some((s) => s.slot) && onAenderungen ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--ck-text-3)' }}>Vorschläge</span>
          {anzeige.slots.map((s, i) =>
            s.slot ? (
              <SlotFeld
                key={i}
                slot={s.slot}
                text={s.text}
                vorbei={s.vorbei}
                jetzt={jetzt}
                onChange={(neu) => setze(i, neu)}
              />
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  )
}

const knopf: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--ck-text-2)',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  minWidth: 28,
  minHeight: 32,
  padding: 0,
}

function SlotFeld({
  slot,
  text,
  vorbei,
  jetzt,
  onChange,
}: {
  slot: Slot
  text: string
  vorbei: boolean
  jetzt: Date
  onChange: (slot: Slot) => void
}) {
  const wert = fensterWert(slot.fenster)
  const optionen = FENSTER_AUSWAHL.some((o) => o.wert === wert)
    ? FENSTER_AUSWAHL
    : [...FENSTER_AUSWAHL, { wert, label: wert.replace(/^(um|ab)-(\d+)(?:-(\d+))?$/, (_, a, h, m) => `${a} ${h}${m ? `:${m.padStart(2, '0')}` : ''} Uhr`), fenster: slot.fenster }]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        border: `1px solid ${vorbei ? 'var(--ck-warn)' : 'var(--ck-border)'}`,
        borderRadius: 'var(--ck-radius-innen)',
        padding: '0 4px',
        fontSize: 12,
      }}
    >
      <button
        type="button"
        style={knopf}
        aria-label={`${text}: einen Werktag früher`}
        onClick={() => onChange(slotVerschieben(slot, -1, jetzt))}
      >
        ‹
      </button>
      <span style={{ color: vorbei ? 'var(--ck-warn)' : 'var(--ck-text-1)', whiteSpace: 'nowrap' }}>
        {slotTagText(slot, jetzt)}
      </span>
      <button
        type="button"
        style={knopf}
        aria-label={`${text}: einen Werktag später`}
        onClick={() => onChange(slotVerschieben(slot, 1, jetzt))}
      >
        ›
      </button>
      <select
        aria-label={`${text}: Uhrzeit`}
        value={wert}
        onChange={(e) => {
          const o = optionen.find((x) => x.wert === e.target.value)
          if (o) onChange({ ...slot, fenster: o.fenster })
        }}
        style={{
          fontSize: 12,
          background: 'transparent',
          color: 'var(--ck-text-2)',
          border: 'none',
          borderLeft: '1px solid var(--ck-border)',
          marginLeft: 2,
          paddingLeft: 4,
          minHeight: 32,
        }}
      >
        {optionen.map((o) => (
          <option key={o.wert} value={o.wert}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  )
}
