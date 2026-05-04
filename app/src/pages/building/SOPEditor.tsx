import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useState } from 'react'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import type { SOP } from '../../types/db'

interface SOPEditorProps {
  sop: SOP
  onChangeTitle: (title: string) => void
  onChangeContent: (content: Record<string, unknown>) => void
  onDelete: () => void
}

const EDITOR_STYLE = {
  minHeight: 200,
  fontSize: 14,
  lineHeight: 1.6,
  padding: '12px 14px',
  color: 'var(--text-primary)',
  outline: 'none',
}

export function SOPEditor({
  sop,
  onChangeTitle,
  onChangeContent,
  onDelete,
}: SOPEditorProps) {
  const [title, setTitle] = useState(sop.title)

  useEffect(() => {
    setTitle(sop.title)
  }, [sop.id, sop.title])

  const debouncedTitle = useDebouncedCallback((v: string) => onChangeTitle(v))
  const debouncedContent = useDebouncedCallback((doc: Record<string, unknown>) =>
    onChangeContent(doc),
  )

  const editor = useEditor({
    extensions: [StarterKit],
    content: sop.content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'sop-editor-root',
        style: `font-family: var(--font-body);`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      debouncedContent(ed.getJSON() as Record<string, unknown>)
    },
  })

  useEffect(() => {
    if (!editor) return
    const a = JSON.stringify(editor.getJSON())
    const b = JSON.stringify(sop.content)
    if (a !== b) {
      editor.commands.setContent(sop.content, { emitUpdate: false })
    }
  }, [editor, sop.id, sop.content])

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label
          className="font-mono mb-1 block"
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--text-tertiary)',
          }}
        >
          Titel
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            debouncedTitle(e.target.value)
          }}
          className="w-full rounded-lg outline-none"
          style={{
            fontSize: 14,
            padding: '8px 10px',
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {editor && (
        <div
          className="flex flex-wrap gap-1"
          style={{
            padding: '6px 8px',
            borderRadius: 8,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        >
          <ToolbarBtn
            label="B"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarBtn
            label="I"
            active={editor.isActive('italic')}
            italic
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarBtn
            label="• Liste"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
        </div>
      )}

      <div
        className="rounded-lg"
        style={{
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
          ...EDITOR_STYLE,
        }}
      >
        {editor && <EditorContent editor={editor} />}
      </div>

      <button
        type="button"
        onClick={() => {
          if (window.confirm(`SOP „${sop.title}“ löschen?`)) onDelete()
        }}
        className="font-mono self-start rounded-lg"
        style={{
          fontSize: 11,
          padding: '6px 12px',
          border: '1px solid var(--glass-border-2)',
          color: 'var(--accent-coral)',
          background: 'transparent',
        }}
      >
        SOP löschen
      </button>
    </div>
  )
}

function ToolbarBtn({
  label,
  active,
  italic,
  onClick,
}: {
  label: string
  active: boolean
  italic?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono rounded-md transition-colors"
      style={{
        fontSize: 11,
        padding: '4px 10px',
        fontWeight: active ? 600 : 400,
        fontStyle: italic && active ? 'italic' : 'normal',
        background: active ? 'var(--glass-4)' : 'transparent',
        border: `1px solid ${
          active ? 'var(--glass-border-3)' : 'var(--glass-border-1)'
        }`,
        color: 'var(--text-primary)',
      }}
    >
      {label}
    </button>
  )
}
