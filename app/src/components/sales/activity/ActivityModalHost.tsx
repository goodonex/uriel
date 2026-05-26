import { useCallback, useEffect, useState } from 'react'
import type { ActivityModalType } from '../../../lib/activityTypes'
import { ACTIVITY_META } from '../../../lib/activityTypes'
import { useActivityEntries } from '../../../hooks/useActivityEntries'
import { useTasks } from '../../../hooks/useTasks'
import type { ActivityEntryType, Contact } from '../../../types/db'
import { useToast } from '../../Toast'
import { FormField, ModalShell, fieldInput } from './activityFormUi'
import { SimpleRichText } from './SimpleRichText'

type Props = {
  brandSlug: string
  contact: Contact
  modal: ActivityModalType | null
  onClose: () => void
  onDone: () => void
  onField: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void
  onOpenCompose: () => void
}

function draftKey(brandSlug: string, contactId: string, type: string) {
  return `brand-os:activity-draft:${brandSlug}:${contactId}:${type}`
}

export function ActivityModalHost({
  brandSlug,
  contact,
  modal,
  onClose,
  onDone,
  onField,
  onOpenCompose,
}: Props) {
  const activities = useActivityEntries(brandSlug, { contactId: contact.id })
  const tasks = useTasks(brandSlug)
  const { show } = useToast()
  const [data, setData] = useState<Record<string, string>>({})

  const activityType: ActivityEntryType | null =
    modal === 'termin' ? 'terminierung' : modal

  useEffect(() => {
    if (!modal || !brandSlug) return
    const key = draftKey(brandSlug, contact.id, modal)
    try {
      const raw = localStorage.getItem(key)
      if (raw) setData(JSON.parse(raw) as Record<string, string>)
      else setData({})
    } catch {
      setData({})
    }
  }, [modal, brandSlug, contact.id])

  const set = (k: string, v: string) => setData((d) => ({ ...d, [k]: v }))

  const saveDraft = () => {
    if (!modal || !brandSlug) return
    localStorage.setItem(draftKey(brandSlug, contact.id, modal), JSON.stringify(data))
    show('Entwurf gespeichert', 'success')
  }

  const clearDraft = () => {
    if (!modal || !brandSlug) return
    localStorage.removeItem(draftKey(brandSlug, contact.id, modal))
  }

  const submit = useCallback(async () => {
    if (!activityType) return
    const { entry: row, error: createError } = await activities.create({
      contact_id: contact.id,
      activity_type: activityType,
      data: { ...data },
    })
    if (!row) {
      console.error('[ActivityModalHost] create failed', activityType, createError)
      show(
        createError ?? 'Aktivität konnte nicht gespeichert werden. Bitte erneut versuchen.',
        'info',
      )
      return
    }

    if (activityType === 'closing' && data.ergebnis === 'Gekauft') {
      onField({ pipeline_stage: 'deal' })
    }
    if (activityType === 'unqualified') {
      onField({ pipeline_stage: 'paused', lead_quality: 'unqualified' })
    }
    if (activityType === 'followup' && data.follow_up_datum) {
      tasks.create({
        title: `Follow Up: ${contact.name || contact.company || 'Lead'}`,
        due_at: new Date(data.follow_up_datum).toISOString(),
        contact_id: contact.id,
        priority: 1,
        source: 'follow_up',
      })
    }
    if (activityType === 'noshow' && data.mail_senden === 'Ja') {
      onOpenCompose()
    }

    clearDraft()
    show(`${ACTIVITY_META[activityType].label} gespeichert`, 'success')
    onDone()
    onClose()
  }, [
    activityType,
    activities,
    contact,
    data,
    onClose,
    onDone,
    onField,
    onOpenCompose,
    show,
    tasks,
  ])

  if (!modal || !activityType) return null

  const title = modal === 'termin' ? 'Terminierung' : ACTIVITY_META[activityType].label

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      onDone={() => void submit()}
      onDraft={saveDraft}
      doneDisabled={activityType === 'terminierung' && !data.termin_datum}
    >
      {activityType === 'presetting' ? (
        <>
          <FormField label="Termin vereinbart?">
            <select value={data.termin_vereinbart ?? ''} onChange={(e) => set('termin_vereinbart', e.target.value)} style={fieldInput}>
              <option value="">—</option>
              <option value="Ja">Ja</option>
              <option value="Nein">Nein</option>
              <option value="Rückruf">Rückruf</option>
            </select>
          </FormField>
          <FormField label="Notizen">
            <SimpleRichText value={data.notizen ?? ''} onChange={(v) => set('notizen', v)} />
          </FormField>
          <FormField label="Ziel der Investition">
            <input value={data.ziel_investition ?? ''} onChange={(e) => set('ziel_investition', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Herausforderungen">
            <input value={data.herausforderungen ?? ''} onChange={(e) => set('herausforderungen', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Erneut versuchen ab">
            <input type="datetime-local" value={data.retry_at ?? ''} onChange={(e) => set('retry_at', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Grund / Ziel des Nachfassens">
            <input value={data.nachfassen_grund ?? ''} onChange={(e) => set('nachfassen_grund', e.target.value)} style={fieldInput} />
          </FormField>
        </>
      ) : null}

      {activityType === 'setting' ? (
        <>
          <FormField label="Termin stattgefunden?">
            <select value={data.termin_stattgefunden ?? ''} onChange={(e) => set('termin_stattgefunden', e.target.value)} style={fieldInput}>
              <option value="">—</option>
              <option value="Ja">Ja</option>
              <option value="NoShow">NoShow</option>
              <option value="Abgesagt">Abgesagt</option>
            </select>
          </FormField>
          <FormField label="Notizen">
            <SimpleRichText value={data.notizen ?? ''} onChange={(v) => set('notizen', v)} />
          </FormField>
          <FormField label="Ziel der Investition">
            <input value={data.ziel_investition ?? ''} onChange={(e) => set('ziel_investition', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Monatliches Nettoeinkommen (€)">
            <input type="number" value={data.nettoeinkommen ?? ''} onChange={(e) => set('nettoeinkommen', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Eigenkapital (€)">
            <input type="number" value={data.eigenkapital ?? ''} onChange={(e) => set('eigenkapital', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Monatliche Rate möglich (€)">
            <input type="number" value={data.monatliche_rate ?? ''} onChange={(e) => set('monatliche_rate', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Interesse an">
            <input value={data.interesse_an ?? ''} onChange={(e) => set('interesse_an', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Closing Termin vereinbart?">
            <select value={data.closing_termin_vereinbart ?? ''} onChange={(e) => set('closing_termin_vereinbart', e.target.value)} style={fieldInput}>
              <option value="">—</option>
              <option value="Ja">Ja</option>
              <option value="Nein">Nein</option>
            </select>
          </FormField>
          {data.closing_termin_vereinbart === 'Ja' ? (
            <FormField label="Closing Termin">
              <input type="datetime-local" value={data.closing_termin ?? ''} onChange={(e) => set('closing_termin', e.target.value)} style={fieldInput} />
            </FormField>
          ) : null}
        </>
      ) : null}

      {activityType === 'closing' ? (
        <>
          <FormField label="Closing Ergebnis" required>
            <select value={data.ergebnis ?? ''} onChange={(e) => set('ergebnis', e.target.value)} style={fieldInput}>
              <option value="">—</option>
              <option value="Gekauft">Gekauft</option>
              <option value="Nicht gekauft">Nicht gekauft</option>
              <option value="Follow Up">Follow Up</option>
              <option value="Entscheidung offen">Entscheidung offen</option>
            </select>
          </FormField>
          <FormField label="Notizen">
            <SimpleRichText value={data.notizen ?? ''} onChange={(v) => set('notizen', v)} />
          </FormField>
          {data.ergebnis === 'Gekauft' ? (
            <>
              <FormField label="Preis (€)">
                <input type="number" value={data.preis ?? ''} onChange={(e) => set('preis', e.target.value)} style={fieldInput} />
              </FormField>
              <FormField label="Grund für den Kauf">
                <input value={data.grund_kauf ?? ''} onChange={(e) => set('grund_kauf', e.target.value)} style={fieldInput} />
              </FormField>
            </>
          ) : null}
          {data.ergebnis === 'Nicht gekauft' ? (
            <FormField label="Grund für den Nicht-Kauf">
              <input value={data.grund_nicht_kauf ?? ''} onChange={(e) => set('grund_nicht_kauf', e.target.value)} style={fieldInput} />
            </FormField>
          ) : null}
          <FormField label="Follow Up Datum">
            <input type="datetime-local" value={data.follow_up_datum ?? ''} onChange={(e) => set('follow_up_datum', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Grund / Ziel des Nachfassens">
            <input value={data.nachfassen_grund ?? ''} onChange={(e) => set('nachfassen_grund', e.target.value)} style={fieldInput} />
          </FormField>
        </>
      ) : null}

      {activityType === 'terminierung' ? (
        <>
          <FormField label="Typ" required>
            <select value={data.typ ?? ''} onChange={(e) => set('typ', e.target.value)} style={fieldInput}>
              <option value="">—</option>
              <option value="Presetting">Presetting</option>
              <option value="Setting">Setting</option>
              <option value="Closing">Closing</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </FormField>
          <FormField label="Terminiert von">
            <input value={data.terminiert_von ?? 'Kevin'} onChange={(e) => set('terminiert_von', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Termin mit">
            <input value={data.termin_mit ?? ''} onChange={(e) => set('termin_mit', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Termin Datum + Uhrzeit" required>
            <input type="datetime-local" value={data.termin_datum ?? ''} onChange={(e) => set('termin_datum', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Notiz">
            <input value={data.notiz ?? ''} onChange={(e) => set('notiz', e.target.value)} style={fieldInput} />
          </FormField>
        </>
      ) : null}

      {activityType === 'unqualified' ? (
        <>
          <FormField label="Unqualified Grund" required>
            <select value={data.grund ?? ''} onChange={(e) => set('grund', e.target.value)} style={fieldInput}>
              <option value="">—</option>
              <option value="Kein Budget">Kein Budget</option>
              <option value="Falsche Zielgruppe">Falsche Zielgruppe</option>
              <option value="Nicht erreichbar">Nicht erreichbar</option>
              <option value="Kein Interesse">Kein Interesse</option>
              <option value="Doppelter Lead">Doppelter Lead</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </FormField>
          {data.grund === 'Sonstiges' ? (
            <FormField label="Sonstige Info">
              <input value={data.sonstige_info ?? ''} onChange={(e) => set('sonstige_info', e.target.value)} style={fieldInput} />
            </FormField>
          ) : null}
        </>
      ) : null}

      {activityType === 'noshow' ? (
        <>
          <FormField label="Typ" required>
            <select value={data.typ ?? ''} onChange={(e) => set('typ', e.target.value)} style={fieldInput}>
              <option value="">—</option>
              <option value="NoShow">NoShow</option>
              <option value="Absage kurzfristig">Absage kurzfristig</option>
              <option value="Absage langfristig">Absage langfristig</option>
            </select>
          </FormField>
          <FormField label="Wer soll Termin neu legen?">
            <input value={data.neu_termin_von ?? ''} onChange={(e) => set('neu_termin_von', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Mail an Lead senden?">
            <select value={data.mail_senden ?? ''} onChange={(e) => set('mail_senden', e.target.value)} style={fieldInput}>
              <option value="">—</option>
              <option value="Ja">Ja</option>
              <option value="Nein">Nein</option>
            </select>
          </FormField>
          <FormField label="Grund">
            <textarea value={data.grund ?? ''} onChange={(e) => set('grund', e.target.value)} rows={3} style={{ ...fieldInput, resize: 'vertical' }} />
          </FormField>
        </>
      ) : null}

      {activityType === 'followup' ? (
        <>
          <FormField label="Follow Up Datum" required>
            <input type="datetime-local" value={data.follow_up_datum ?? ''} onChange={(e) => set('follow_up_datum', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Kontaktweg">
            <select value={data.kontaktweg ?? ''} onChange={(e) => set('kontaktweg', e.target.value)} style={fieldInput}>
              <option value="">—</option>
              <option value="Telefon">Telefon</option>
              <option value="E-Mail">E-Mail</option>
              <option value="WhatsApp">WhatsApp</option>
            </select>
          </FormField>
          <FormField label="Grund / Ziel">
            <input value={data.grund ?? ''} onChange={(e) => set('grund', e.target.value)} style={fieldInput} />
          </FormField>
        </>
      ) : null}

      {activityType === 'formular' ? (
        <>
          <FormField label="Formular gesendet?">
            <select value={data.gesendet ?? ''} onChange={(e) => set('gesendet', e.target.value)} style={fieldInput}>
              <option value="">—</option>
              <option value="Ja">Ja</option>
              <option value="Nein">Nein</option>
              <option value="Ausstehend">Ausstehend</option>
            </select>
          </FormField>
          <FormField label="Formular-Link">
            <input value={data.link ?? ''} onChange={(e) => set('link', e.target.value)} style={fieldInput} />
          </FormField>
          <FormField label="Notiz">
            <input value={data.notiz ?? ''} onChange={(e) => set('notiz', e.target.value)} style={fieldInput} />
          </FormField>
        </>
      ) : null}

      {activityType === 'notiz' ? (
        <FormField label="Notiz" required>
          <SimpleRichText value={data.text ?? ''} onChange={(v) => set('text', v)} minHeight={120} />
        </FormField>
      ) : null}
    </ModalShell>
  )
}
