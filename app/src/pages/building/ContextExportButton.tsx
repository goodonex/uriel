import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { buildContextMarkdown } from '../../lib/contextExport'
import { useAssets } from '../../hooks/useAssets'
import { useBusinessModel } from '../../hooks/useBusinessModel'
import { useContacts } from '../../hooks/useContacts'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import type { Brand, ICP, Positioning, WordBankEntry } from '../../types/db'

interface ContextExportButtonProps {
  brand: Brand | null
  positioning: Positioning | null
  icps: ICP[]
  wordBank: WordBankEntry[]
}

export function ContextExportButton({
  brand,
  positioning,
  icps,
  wordBank,
}: ContextExportButtonProps) {
  const { slug } = useParams<{ slug: string }>()
  const businessModel = useBusinessModel(slug)
  const assets = useAssets(slug)
  const contacts = useContacts(slug)
  const deliver = useDeliverProjects(slug)
  const { show } = useToast()
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    if (!brand) return
    setBusy(true)
    try {
      const md = buildContextMarkdown({
        brand,
        positioning,
        icps,
        wordBank,
        businessModel: businessModel.item,
        assets: assets.items,
        contacts: contacts.items,
        deliverProjects: deliver.items,
      })
      if (!navigator.clipboard) {
        show('Clipboard nicht verfügbar', 'error')
        return
      }
      await navigator.clipboard.writeText(md)
      show('Context in Zwischenablage', 'success')
    } catch (err) {
      show(
        err instanceof Error ? err.message : 'Copy fehlgeschlagen',
        'error',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!brand || busy}
      className="font-mono rounded-lg transition-colors"
      style={{
        fontSize: 11,
        padding: '6px 14px',
        background: 'var(--glass-3)',
        border: '1px solid var(--glass-border-2)',
        color: 'var(--text-primary)',
        opacity: !brand || busy ? 0.5 : 1,
        cursor: !brand || busy ? 'not-allowed' : 'pointer',
      }}
    >
      {busy ? 'Kopiere…' : 'Copy for Claude ↗'}
    </button>
  )
}
