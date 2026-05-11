import { useNavigate, useParams } from 'react-router-dom'
import { useBrands } from '../hooks/useBrands'

export function BrandSwitcher() {
  const { brands, loading, error } = useBrands()
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[26px] w-24 animate-pulse rounded-full"
            style={{
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-1)',
            }}
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <span
        className="font-mono text-xs"
        style={{ color: 'var(--accent-coral)' }}
      >
        Brands konnten nicht geladen werden
      </span>
    )
  }

  return (
    <div className="flex w-max flex-nowrap gap-1.5">
      {brands.map((brand) => {
        const active = brand.slug === slug
        return (
          <button
            key={brand.id}
            type="button"
            onClick={() => navigate(`/brand/${brand.slug}/dashboard`)}
            className="rounded-full transition-all duration-200 ease-out"
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '5px 12px',
              background: active ? 'var(--glass-4)' : 'var(--glass-1)',
              border: active
                ? '1px solid var(--glass-border-3)'
                : '1px solid var(--glass-border-2)',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {brand.name}
          </button>
        )
      })}
    </div>
  )
}
