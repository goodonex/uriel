import {
  instagramEmbedUrl,
  linkedInProfileUrl,
  normalizeWebsiteUrl,
} from '../../lib/contactUrls'

function EmbedFrame({
  title,
  src,
  height,
}: {
  title: string
  src: string
  height: number
}) {
  return (
    <div
      className="glass-2 overflow-hidden"
      style={{
        borderRadius: 14,
        border: '1px solid var(--glass-border-1)',
        height,
      }}
    >
      <iframe
        title={title}
        src={src}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        style={{ width: '100%', height: '100%', border: 'none', background: '#0e0e12' }}
      />
    </div>
  )
}

export function ContactPresenceEmbeds({
  website,
  instagram,
  linkedin,
}: {
  website: string
  instagram: string
  linkedin: string
}) {
  const webUrl = normalizeWebsiteUrl(website)
  const igEmbed = instagramEmbedUrl(instagram)
  const liUrl = linkedInProfileUrl(linkedin)

  if (!webUrl && !igEmbed && !liUrl) return null

  return (
    <div className="flex flex-col gap-4">
      <div
        className="font-mono"
        style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
      >
        PRÄSENZ
      </div>
      {webUrl ? (
        <div>
          <div className="font-mono mb-2" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
            Website
          </div>
          <EmbedFrame title="Website" src={webUrl} height={300} />
        </div>
      ) : null}
      {igEmbed ? (
        <div>
          <div className="font-mono mb-2" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
            Instagram
          </div>
          <EmbedFrame title="Instagram" src={igEmbed} height={380} />
        </div>
      ) : null}
      {liUrl ? (
        <div
          className="glass-2 rounded-xl p-4"
          style={{ border: '1px solid var(--glass-border-1)' }}
        >
          <div className="font-mono mb-2" style={{ fontSize: 10, color: '#0A66C2' }}>
            LinkedIn
          </div>
          <a
            href={liUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono"
            style={{ fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all' }}
          >
            {liUrl}
          </a>
          <p className="font-mono mt-2" style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: 0 }}>
            LinkedIn erlaubt keine Einbettung — Profil im neuen Tab öffnen.
          </p>
        </div>
      ) : null}
    </div>
  )
}
