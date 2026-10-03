/**
 * Anrufliste (29.09.2026) — Kevins Dialer über alle Unternehmen.
 *
 * Eine Zeile je Unternehmen, sortiert nach Hitze → Punkte → Handy. Oben
 * „Nächster": öffnet den ersten Eintrag, Anrufen ist ein Klick (tel:), Website
 * und LinkedIn daneben. Nach dem Gespräch ein Ergebnis-Knopf, optional eine
 * Notiz — gespeichert als Anruf-Ereignis am Lead (bzw. am Listeneintrag), dann
 * springt die Seite zum nächsten. Die Logik steht in `lib/anrufListe.ts`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCurrentBrandSlug } from '../../../hooks/useCurrentBrandSlug'
import { useLeads } from '../../../hooks/useLeads'
import { useLinkedinThreads } from '../../../hooks/useLinkedinThreads'
import { useBrandId } from '../../../hooks/useBrandId'
import { supabase } from '../../../lib/supabase'
import { useDailyMetrics } from '../../lib/useDailyMetrics'
import {
  ERGEBNISSE,
  GRUPPEN,
  baueAnrufListe,
  type AnrufEintrag,
  type AnrufErgebnis,
  type AnrufGruppe,
} from '../../lib/anrufListe'
import type { ContactListItem } from '../../../types/db'
import { trenneListen } from '../../lib/listenQuellen'

const nummerLesbar = (e164: string) =>
  e164.replace(/^\+49(\d{3,4})(\d+)$/, '0$1 $2').replace(/^\+4([13])(\d{2})(\d+)$/, '+4$1 $2 $3')

function morgenUm9(tage = 1): string {
  const d = new Date()
  d.setDate(d.getDate() + tage)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

export function AnrufListePage() {
  const slug = useCurrentBrandSlug()
  const brandId = useBrandId(slug)
  const leadsQuery = useLeads(slug)
  const threads = useLinkedinThreads(slug)
  const { bump } = useDailyMetrics()

  const [listItems, setListItems] = useState<ContactListItem[]>([])
  const [recherchierteItems, setRecherchierteItems] = useState<ContactListItem[]>([])
  const [erledigt, setErledigt] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<AnrufGruppe | 0>(0)
  const [offenKey, setOffenKey] = useState<string | null>(null)
  const [notiz, setNotiz] = useState('')
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState('')

  // Kevins Kaltakquise-Listen, alle auf einmal.
  useEffect(() => {
    if (!supabase || !brandId) return
    void (async () => {
      const { data: listen } = await supabase.from('contact_lists').select('id,list_type').eq('brand_id', brandId)
      const { kaltakquise, recherchiert } = trenneListen((listen ?? []) as Array<{ id: string; list_type: string | null }>)
      const laden = async (ls: Array<{ id: string }>) => {
        if (!ls.length) return [] as ContactListItem[]
        const { data } = await supabase!.from('contact_list_items').select('*').in('list_id', ls.map((l) => l.id)).limit(5000)
        return (data ?? []) as ContactListItem[]
      }
      setListItems(await laden(kaltakquise))
      setRecherchierteItems(await laden(recherchiert))
    })()
  }, [brandId])

  const liste = useMemo(
    () =>
      baueAnrufListe({
        leads: leadsQuery.leads as never,
        threads: threads.items,
        ereignisse: leadsQuery.ereignisse,
        listItems,
        recherchierteItems,
      }),
    [leadsQuery.leads, leadsQuery.ereignisse, threads.items, listItems, recherchierteItems],
  )
  const sichtbar = useMemo(
    () => liste.eintraege.filter((e) => !erledigt.has(e.key) && (filter === 0 || e.gruppe === filter)),
    [liste.eintraege, erledigt, filter],
  )
  const offen = sichtbar.find((e) => e.key === offenKey) ?? null

  const oeffne = useCallback((e: AnrufEintrag | null) => {
    setOffenKey(e?.key ?? null)
    setNotiz('')
    setFehler('')
  }, [])

  const speichere = useCallback(
    async (e: AnrufEintrag, ergebnis: AnrufErgebnis) => {
      setSpeichert(true)
      setFehler('')
      try {
        const rueckruf_am = ergebnis === 'rueckruf' ? morgenUm9() : undefined
        if (e.quelle === 'lead' && e.leadId) {
          await leadsQuery.protokolliere(e.leadId, 'anruf', {
            ergebnis,
            nummer: e.nummer,
            ...(notiz.trim() ? { notiz: notiz.trim().slice(0, 500) } : {}),
            ...(rueckruf_am ? { rueckruf_am } : {}),
          })
          // Ja zum Video am Telefon ist dasselbe Ja wie im Chat: ab in die Loom-Bauliste.
          if (ergebnis === 'video_ja') await leadsQuery.protokolliere(e.leadId, 'loom_zugesagt', { quelle: 'anruf' })
        } else if (e.listItemId && supabase) {
          const status = ergebnis === 'kein_interesse' ? 'kein_interesse' : ergebnis === 'termin' || ergebnis === 'video_ja' ? 'in_pipeline' : 'angerufen'
          const zeile = `${new Date().toLocaleDateString('de-DE')} Anruf: ${ERGEBNISSE.find((x) => x.key === ergebnis)?.label}${notiz.trim() ? ` — ${notiz.trim()}` : ''}`
          const alt = [...listItems, ...recherchierteItems].find((i) => i.id === e.listItemId)?.notes ?? ''
          const { error } = await supabase
            .from('contact_list_items')
            .update({ status, called_at: new Date().toISOString(), outcome: ergebnis, notes: alt ? `${zeile}\n${alt}` : zeile })
            .eq('id', e.listItemId)
          if (error) throw new Error(error.message)
        }
        bump('cold_calls', 1)
        if (ergebnis === 'termin') bump('termine_call', 1)
        setErledigt((s) => new Set(s).add(e.key))
        // Direkt zum nächsten Eintrag derselben Ansicht.
        const i = sichtbar.findIndex((x) => x.key === e.key)
        oeffne(sichtbar[i + 1] ?? null)
      } catch (err) {
        setFehler(err instanceof Error ? err.message : String(err))
      } finally {
        setSpeichert(false)
      }
    },
    [bump, leadsQuery, listItems, recherchierteItems, notiz, oeffne, sichtbar],
  )

  const laedt = leadsQuery.loading || threads.loading

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Anrufliste</h2>
        <span style={{ color: 'var(--ck-text-3)' }}>
          {laedt ? 'lädt …' : `${sichtbar.length} dran · heute angerufen: ${liste.heuteAngerufen + erledigt.size}`}
        </span>
        <button
          type="button"
          className="ck-btn ck-btn--primary"
          style={{ marginLeft: 'auto', minHeight: 44 }}
          disabled={!sichtbar.length}
          onClick={() => oeffne(sichtbar[0] ?? null)}
        >
          Nächster anrufen
        </button>
      </div>

      <nav className="ck-segmente" aria-label="Gruppen">
        <button type="button" className={`ck-segment${filter === 0 ? ' active' : ''}`} onClick={() => setFilter(0)}>
          Alle {liste.eintraege.length - erledigt.size}
        </button>
        {([1, 2, 3, 4, 5, 6] as AnrufGruppe[]).map((g) => (
          <button key={g} type="button" className={`ck-segment${filter === g ? ' active' : ''}`} onClick={() => setFilter(g)} title={GRUPPEN[g].hinweis}>
            {g} · {GRUPPEN[g].titel} {liste.jeGruppe[g]}
          </button>
        ))}
      </nav>

      {offen ? (
        <div className="ck-panel" style={{ padding: 18, display: 'grid', gap: 12, borderColor: 'var(--ck-accent)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 20 }}>{offen.firma}</strong>
            <span>{offen.name}</span>
            <span style={{ color: 'var(--ck-text-3)' }}>{offen.rolle}</span>
            <span style={{ color: 'var(--ck-text-3)', marginLeft: 'auto' }}>
              {GRUPPEN[offen.gruppe].titel} · {offen.punkte} Punkte{offen.versuche ? ` · ${offen.versuche}× nicht erreicht` : ''}
            </span>
          </div>
          {offen.grund ? <div style={{ color: 'var(--ck-text-2)' }}>{offen.grund}</div> : null}
          {offen.weitere.length ? (
            <div style={{ color: 'var(--ck-text-3)', fontSize: 13 }}>Auch vernetzt: {offen.weitere.join(', ')}</div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a className="ck-btn ck-btn--primary" style={{ minHeight: 48, fontSize: 18 }} href={`tel:${offen.nummer}`}>
              {nummerLesbar(offen.nummer)} anrufen {offen.nummerArt === 'mobil' ? '· Handy' : '· Festnetz'}
            </a>
            {offen.website ? (
              <a className="ck-btn" style={{ minHeight: 48 }} href={offen.website} target="_blank" rel="noreferrer">
                Website ↗
              </a>
            ) : null}
            {offen.linkedin ? (
              <a className="ck-btn" style={{ minHeight: 48 }} href={offen.linkedin} target="_blank" rel="noreferrer">
                LinkedIn ↗
              </a>
            ) : null}
            <button type="button" className="ck-btn" style={{ minHeight: 48, marginLeft: 'auto' }} onClick={() => oeffne(null)}>
              Schließen
            </button>
          </div>
          <textarea
            className="ck-input"
            rows={2}
            placeholder="Notiz zum Gespräch (optional)"
            value={notiz}
            onChange={(ev) => setNotiz(ev.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ERGEBNISSE.map((x) => (
              <button
                key={x.key}
                type="button"
                className="ck-btn"
                disabled={speichert}
                style={{
                  minHeight: 44,
                  ...(x.ton === 'gut' ? { color: 'var(--ck-accent)', borderColor: 'var(--ck-accent)' } : {}),
                  ...(x.ton === 'schlecht' ? { color: 'var(--ck-text-3)' } : {}),
                }}
                onClick={() => void speichere(offen, x.key)}
              >
                {x.label}
              </button>
            ))}
          </div>
          {fehler ? <div style={{ color: 'var(--ck-warn)' }}>{fehler}</div> : null}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 6 }}>
        {sichtbar.slice(0, 300).map((e) => (
          <button
            key={e.key}
            type="button"
            className="ck-panel"
            onClick={() => oeffne(e)}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.4fr) 150px 70px',
              gap: 12,
              alignItems: 'center',
              padding: '10px 14px',
              textAlign: 'left',
              cursor: 'pointer',
              borderColor: e.key === offenKey ? 'var(--ck-accent)' : undefined,
            }}
          >
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.firma}</strong>
              <span style={{ color: 'var(--ck-text-3)', fontSize: 13 }}>
                {e.name}
                {e.weitere.length ? ` +${e.weitere.length}` : ''}
              </span>
            </span>
            <span style={{ color: 'var(--ck-text-3)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.grund.replace(/^[^—]*—\s*/, '')}
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {nummerLesbar(e.nummer)}
              <span style={{ color: e.nummerArt === 'mobil' ? 'var(--ck-accent)' : 'var(--ck-text-3)', fontSize: 12 }}>
                {' '}
                {e.nummerArt === 'mobil' ? 'Handy' : 'Fest'}
              </span>
            </span>
            <span style={{ textAlign: 'right', color: 'var(--ck-text-2)' }}>{e.punkte}</span>
          </button>
        ))}
        {sichtbar.length > 300 ? (
          <div style={{ color: 'var(--ck-text-3)', padding: 8 }}>… und {sichtbar.length - 300} weitere. „Nächster anrufen" arbeitet die ganze Liste ab.</div>
        ) : null}
        {!laedt && liste.ohneNummer ? (
          <div style={{ color: 'var(--ck-text-3)', fontSize: 13, padding: 8 }}>
            {liste.ohneNummer} Kontakte ohne Nummer (meist ohne Website) stehen nicht in der Liste.
          </div>
        ) : null}
      </div>
    </div>
  )
}
