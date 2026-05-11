import { createContext, useContext } from 'react'

export interface CommandPaletteContextValue {
  open: boolean
  openPalette: () => void
  closePalette: () => void
}

const noop = () => {
  /* fallback */
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: false,
  openPalette: noop,
  closePalette: noop,
})

export function useCommandPalette(): CommandPaletteContextValue {
  return useContext(CommandPaletteContext)
}
