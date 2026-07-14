export function Background() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ background: 'var(--bg-void)' }}
    >
      <div
        className="absolute rounded-full"
        style={{
          width: 600,
          height: 600,
          top: -200,
          left: -100,
          background: 'var(--accent-blue)',
          filter: 'blur(80px)',
          opacity: 'var(--bg-blob-opacity)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 500,
          height: 500,
          bottom: -150,
          right: -100,
          background: 'var(--accent-purple)',
          filter: 'blur(80px)',
          opacity: 'var(--bg-blob-opacity)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 300,
          height: 300,
          top: '40%',
          left: '50%',
          background: 'var(--accent-teal)',
          filter: 'blur(80px)',
          opacity: 'var(--bg-blob-opacity)',
        }}
      />
    </div>
  )
}
