import { useState } from 'react'
import {
  instagramEmbedUrl,
  linkedInProfileUrl,
  normalizeWebsiteUrl,
} from '../../lib/contactUrls'

function WebsitePreview({ url }: { url: string }) {
  const [useScreenshot, setUseScreenshot] = useState(false)
  const shot = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`

  if (useScreenshot) {
    return (
      <img
        src={shot}
        alt="Website Vorschau"
        style={{ width: '100%', height: 300, objectFit: 'cover', objectPosition: 'top', borderRadius: 14 }}
        onError={() => setUseScreenshot(false)}
      />
    )
  }

  return (
    <iframe
      title="Website"
      src={url}
      sandbox="allow-same-origin"
      onError={() => setUseScreenshot(true)}
      style={{ width: '100%', height: 300, border: 'none', borderRadius: 14, background: '#0e0e12' }}
    />
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
      <div className="font-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}>
        PRÄSENZ
      </div>
      {webUrl ? (
        <div>
          <div className="font-mono mb-2" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
            Website
          </div>
          <div className="glass-2 overflow-hidden" style={{ borderRadius: 14, border: '1px solid var(--glass-border-1)' }}>
            <WebsitePreview url={webUrl} />
          </div>
          <button
            type="button"
            className="font-mono mt-2"
            style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => window.open(webUrl, '_blank', 'noopener,noreferrer')}
          >
            Im Tab öffnen
          </button>
        </div>
      ) : null}
      {igEmbed ? (
        <div>
          <div className="font-mono mb-2" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
            Instagram
          </div>
          <div className="glass-2 overflow-hidden" style={{ borderRadius: 14, border: '1px solid var(--glass-border-1)', height: 380 }}>
            <iframe
              title="Instagram"
              src={igEmbed}
              sandbox="allow-same-origin"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        </div>
      ) : null}
      {liUrl ? (
        <div className="glass-2 rounded-xl p-4" style={{ border: '1px solid var(--glass-border-1)' }}>
          <div className="font-mono mb-2" style={{ fontSize: 10, color: '#0A66C2' }}>
            LinkedIn
          </div>
          <a href={liUrl} target="_blank" rel="noreferrer" className="font-mono" style={{ fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
            {liUrl}
          </a>
        </div>
      ) : null}
    </div>
  )
}
