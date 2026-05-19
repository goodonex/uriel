/** Levenshtein-Distanz zwischen zwei Strings (case-insensitive). */
export function levenshteinDistance(a: string, b: string): number {
  const s = a.trim().toLowerCase()
  const t = b.trim().toLowerCase()
  if (s === t) return 0
  if (s.length === 0) return t.length
  if (t.length === 0) return s.length

  const rows = s.length + 1
  const cols = t.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (let i = 0; i < rows; i++) matrix[i][0] = i
  for (let j = 0; j < cols; j++) matrix[0][j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }

  return matrix[rows - 1][cols - 1]
}

/** Ähnlichkeit 0–100 (100 = identisch). */
export function similarityPercent(a: string, b: string): number {
  const s = a.trim()
  const t = b.trim()
  if (!s || !t) return 0
  const maxLen = Math.max(s.length, t.length)
  if (maxLen === 0) return 100
  const dist = levenshteinDistance(s, t)
  return Math.round((1 - dist / maxLen) * 100)
}
