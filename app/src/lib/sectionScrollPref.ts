const STORAGE_KEY = 'brand-os-section-scroll-enabled'

export function readSectionScrollEnabled(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* ignore */
  }
  return false
}

export function writeSectionScrollEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}
