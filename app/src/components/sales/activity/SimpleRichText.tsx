import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'

export function SimpleRichText({
  value,
  onChange,
  placeholder,
  minHeight = 88,
}: {
  value: string
  onChange: (plain: string) => void
  placeholder?: string
  minHeight?: number
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value ? `<p>${value.replace(/\n/g, '</p><p>')}</p>` : '',
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getText())
    },
    editorProps: {
      attributes: {
        class: 'font-mono',
        style: `min-height:${minHeight}px;padding:8px 10px;font-size:12px;outline:none;color:var(--text-primary)`,
        'data-placeholder': placeholder ?? '',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getText()
    if (value !== current) {
      editor.commands.setContent(value ? `<p>${value.replace(/\n/g, '</p><p>')}</p>` : '')
    }
  }, [editor, value])

  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid var(--glass-border-2)',
        background: 'var(--glass-2)',
      }}
    >
      <EditorContent editor={editor} />
    </div>
  )
}
