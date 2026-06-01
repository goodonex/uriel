/** BOM aus Excel-Exporten entfernen */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function detectCsvDelimiter(sampleLine: string): ',' | ';' | '\t' {
  let comma = 0
  let semi = 0
  let tab = 0
  let inQuotes = false
  for (let i = 0; i < sampleLine.length; i++) {
    const ch = sampleLine[i]
    if (ch === '"') {
      if (inQuotes && sampleLine[i + 1] === '"') {
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (inQuotes) continue
    if (ch === ',') comma++
    else if (ch === ';') semi++
    else if (ch === '\t') tab++
  }
  if (tab >= semi && tab >= comma && tab > 0) return '\t'
  if (semi >= comma && semi > 0) return ';'
  return ','
}

function parseCsvWithDelimiter(text: string, delim: ',' | ';' | '\t'): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      cur.push(field)
      field = ''
    } else if (ch === '\n') {
      cur.push(field)
      rows.push(cur)
      cur = []
      field = ''
    } else if (ch === '\r') {
      /* skip */
    } else {
      field += ch
    }
  }

  if (field.length > 0 || cur.length > 0) {
    cur.push(field)
    rows.push(cur)
  }

  return rows
}

/** Zeilen auf gleiche Spaltenzahl bringen, leere Zeilen entfernen */
export function normalizeCsvGrid(rows: string[][]): string[][] {
  const trimmed = rows.map((r) => r.map((c) => c.trim()))
  const nonEmpty = trimmed.filter((r) => r.some((c) => c.length > 0))
  if (nonEmpty.length === 0) return []
  const widths = nonEmpty.map((r) => r.length)
  const width = Math.max(...widths)
  const headerWidth = nonEmpty[0]?.length ?? width
  const targetWidth = Math.max(width, headerWidth)
  return nonEmpty.map((r) => {
    if (r.length >= targetWidth) return r.slice(0, targetWidth)
    return [...r, ...Array(targetWidth - r.length).fill('')]
  })
}

function scoreGrid(grid: string[][]): number {
  if (grid.length < 2) return 0
  const widths = grid.map((r) => r.length)
  const maxW = Math.max(...widths)
  const modeW = widths.sort(
    (a, b) =>
      widths.filter((w) => w === b).length - widths.filter((w) => w === a).length,
  )[0]
  const consistent = widths.filter((w) => w === modeW).length / widths.length
  return consistent * 1000 + modeW
}

/** RFC-ähnlicher CSV-Parser; wählt Delimiter anhand konsistenter Spaltenzahl. */
export function parseCsv(text: string): string[][] {
  const normalized = stripBom(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!normalized.trim()) return []

  const delimiters: Array<',' | ';' | '\t'> = [';', ',', '\t']
  let bestGrid: string[][] = []
  let bestScore = -1

  for (const delim of delimiters) {
    const grid = normalizeCsvGrid(parseCsvWithDelimiter(normalized, delim))
    const score = scoreGrid(grid)
    if (score > bestScore) {
      bestScore = score
      bestGrid = grid
    }
  }

  return bestGrid
}
