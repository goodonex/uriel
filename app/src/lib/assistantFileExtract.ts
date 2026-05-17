import mammoth from 'mammoth'
import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const MAX_CHARS = 15_000

export type FileExtractResult =
  | { ok: true; text: string; truncated: boolean }
  | { ok: false; error: string }

const ACCEPT =
  '.pdf,.txt,.md,.markdown,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function assistantFileAccept(): string {
  return ACCEPT
}

async function extractPdf(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    if (line.trim()) parts.push(line.trim())
    if (parts.join('\n').length > MAX_CHARS + 2000) break
  }
  return parts.join('\n\n')
}

async function extractDocx(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buf })
  return result.value
}

export async function extractFileText(file: File): Promise<FileExtractResult> {
  const name = file.name.toLowerCase()
  const type = file.type

  try {
    let raw = ''
    if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown') || type === 'text/plain' || type === 'text/markdown') {
      raw = await file.text()
    } else if (name.endsWith('.pdf') || type === 'application/pdf') {
      raw = await extractPdf(file)
    } else if (
      name.endsWith('.docx') ||
      type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      raw = await extractDocx(file)
    } else {
      return { ok: false, error: 'Dateityp nicht unterstützt (PDF, TXT, MD, DOCX).' }
    }

    const trimmed = raw.replace(/\r\n/g, '\n').trim()
    if (!trimmed) {
      return { ok: false, error: 'Datei enthält keinen lesbaren Text.' }
    }

    const truncated = trimmed.length > MAX_CHARS
    return {
      ok: true,
      text: truncated ? trimmed.slice(0, MAX_CHARS) : trimmed,
      truncated,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Datei konnte nicht gelesen werden.',
    }
  }
}
