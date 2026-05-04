import { motion } from 'framer-motion'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import type { Asset, AssetType } from '../../types/db'

interface AssetsSectionProps {
  items: Asset[]
  loading: boolean
  error: string | null
  onCreate: () => Asset
  onUpdate: (id: string, patch: Partial<Omit<Asset, 'id' | 'brand_id'>>) => void
  onRemove: (id: string) => void
}

const ASSET_TYPES: AssetType[] = [
  'website',
  'instagram',
  'linkedin',
  'document',
]

export function AssetsSection({
  items,
  loading,
  error,
  onCreate,
  onUpdate,
  onRemove,
}: AssetsSectionProps) {
  if (loading) return <SkeletonGrid />
  if (error) {
    return (
      <div
        className="font-mono"
        style={{ fontSize: 12, color: 'var(--accent-coral)' }}
      >
        Assets konnten nicht geladen werden: {error}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((asset, idx) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          index={idx}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
      <motion.button
        type="button"
        onClick={() => onCreate()}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: items.length * 0.05,
          duration: 0.4,
          ease: [0.16, 1, 0.3, 1],
        }}
        whileHover={{ y: -1 }}
        className="flex min-h-[200px] items-center justify-center text-left transition-colors"
        style={{
          padding: 16,
          borderRadius: 12,
          background: 'var(--glass-1)',
          border: '1px dashed var(--glass-border-2)',
          color: 'var(--text-tertiary)',
        }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          + Neues Asset
        </span>
      </motion.button>
    </div>
  )
}

function AssetCard({
  asset,
  index,
  onUpdate,
  onRemove,
}: {
  asset: Asset
  index: number
  onUpdate: (id: string, patch: Partial<Omit<Asset, 'id' | 'brand_id'>>) => void
  onRemove: (id: string) => void
}) {
  const debouncedName = useDebouncedCallback((v: string) =>
    onUpdate(asset.id, { name: v }),
  )
  const debouncedUrl = useDebouncedCallback((v: string) =>
    onUpdate(asset.id, { url: v }),
  )

  const iframeSrc =
    asset.embed && asset.url.trim()
      ? /^https?:\/\//i.test(asset.url.trim())
        ? asset.url.trim()
        : `https://${asset.url.trim()}`
      : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="flex flex-col text-left"
      style={{
        padding: 16,
        borderRadius: 12,
        background: 'var(--glass-2)',
        border: '1px solid var(--glass-border-1)',
        backdropFilter: 'var(--blur-md)',
        WebkitBackdropFilter: 'var(--blur-md)',
      }}
    >
      <input
        type="text"
        defaultValue={asset.name}
        key={`${asset.id}-name`}
        onChange={(e) => debouncedName(e.target.value)}
        placeholder="Name"
        className="mb-2 w-full rounded-lg outline-none"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          fontWeight: 600,
          padding: '6px 8px',
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
          color: 'var(--text-primary)',
        }}
      />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label
          className="font-mono"
          style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
        >
          Typ
        </label>
        <select
          value={asset.type}
          onChange={(e) =>
            onUpdate(asset.id, { type: e.target.value as AssetType })
          }
          className="rounded-lg outline-none"
          style={{
            fontSize: 12,
            padding: '4px 8px',
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-2)',
            color: 'var(--text-secondary)',
          }}
        >
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label
          className="ml-auto flex cursor-pointer items-center gap-1.5 font-mono"
          style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
        >
          <input
            type="checkbox"
            checked={asset.embed}
            onChange={(e) => onUpdate(asset.id, { embed: e.target.checked })}
          />
          Embed
        </label>
      </div>
      <input
        type="text"
        defaultValue={asset.url}
        key={`${asset.id}-url`}
        onChange={(e) => debouncedUrl(e.target.value)}
        placeholder="https://…"
        className="mb-2 w-full rounded-lg outline-none"
        style={{
          fontSize: 12,
          padding: '8px 10px',
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
          color: 'var(--text-primary)',
        }}
      />
      {iframeSrc ? (
        <div
          className="mt-1 overflow-hidden rounded-lg"
          style={{
            border: '1px solid var(--glass-border-1)',
            height: 160,
            background: 'var(--bg-base)',
          }}
        >
          <iframe
            title={asset.name}
            src={iframeSrc}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Asset „${asset.name}“ löschen?`)) onRemove(asset.id)
        }}
        className="font-mono mt-3 self-start rounded-lg"
        style={{
          fontSize: 10,
          padding: '4px 10px',
          border: '1px solid var(--glass-border-2)',
          color: 'var(--accent-coral)',
          background: 'transparent',
        }}
      >
        Entfernen
      </button>
    </motion.div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            minHeight: 200,
            borderRadius: 12,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        />
      ))}
    </div>
  )
}
