import ReactMarkdown from 'react-markdown'

export function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p style={{ margin: '0 0 8px', lineHeight: 1.45, fontSize: 13 }}>{children}</p>
        ),
        ul: ({ children }) => (
          <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 13 }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 13 }}>{children}</ol>
        ),
        li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
        strong: ({ children }) => <strong style={{ color: 'var(--text-primary)' }}>{children}</strong>,
        code: ({ children }) => (
          <code
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 11,
              background: 'rgba(255,255,255,0.08)',
              padding: '1px 4px',
              borderRadius: 4,
            }}
          >
            {children}
          </code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
