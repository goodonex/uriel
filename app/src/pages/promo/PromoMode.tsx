import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { SectionLabel } from '../../components/SectionLabel'
import { useToast } from '../../components/Toast'
import { useCampaigns } from '../../hooks/useCampaigns'
import { useContentPieces } from '../../hooks/useContentPieces'
import { useICPs } from '../../hooks/useICPs'
import { useWordBank } from '../../hooks/useWordBank'
import { CampaignsSection } from './CampaignsSection'
import { ContentPiecesSection } from './ContentPiecesSection'
import { PromoCalendar } from './PromoCalendar'

export function PromoMode() {
  const { slug } = useParams<{ slug: string }>()
  const { show } = useToast()

  const pieces = useContentPieces(slug)
  const campaigns = useCampaigns(slug)
  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)

  const removeCampaign = (id: string) => {
    for (const p of pieces.items) {
      if (p.campaign_id === id) {
        pieces.update(p.id, { campaign_id: null })
      }
    }
    campaigns.remove(id)
  }

  return (
    <motion.div
      key={slug}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'transparent' }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--mode-promo)',
              marginBottom: 6,
            }}
          >
            Promo Mode
          </div>
          <h2
            className="font-display"
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.3px',
            }}
          >
            Content &amp; Kampagnen
          </h2>
        </div>
      </div>

      <SectionLabel accent="var(--mode-promo)" tight>
        Kalender
      </SectionLabel>
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <PromoCalendar pieces={pieces.items} />
        <div
          className="glass-2 flex flex-col justify-center"
          style={{
            borderRadius: 16,
            padding: 18,
            border: '1px solid var(--glass-border-1)',
          }}
        >
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Kompakte Monatsübersicht für geplante Pieces. Details bearbeitest du in
            den Cards unten oder im Drawer — Performance und API-Mocks sitzen am
            Piece.
          </p>
        </div>
      </div>

      <SectionLabel accent="var(--mode-promo)">Content-Pieces</SectionLabel>
      <ContentPiecesSection
        items={pieces.items}
        campaigns={campaigns.items}
        icps={icps.items}
        wordBank={wordBank.items}
        loading={pieces.loading}
        error={pieces.error}
        onCreate={() => pieces.create()}
        onUpdate={pieces.update}
        onDelete={pieces.remove}
        onAutoTagged={() => show('Tags aus Foundation ergänzt', 'success')}
      />

      <SectionLabel accent="var(--mode-promo)">Kampagnen</SectionLabel>
      <CampaignsSection
        campaigns={campaigns.items}
        pieces={pieces.items}
        loading={campaigns.loading}
        error={campaigns.error}
        onCreate={() => campaigns.create()}
        onUpdate={campaigns.update}
        onDelete={removeCampaign}
      />
    </motion.div>
  )
}
