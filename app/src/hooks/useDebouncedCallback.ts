import { useCallback, useEffect, useRef } from 'react'

export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay = 400,
): (...args: TArgs) => void {
  const cbRef = useRef(callback)
  const timerRef = useRef<number | null>(null)

  cbRef.current = callback

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  return useCallback(
    (...args: TArgs) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        cbRef.current(...args)
      }, delay)
    },
    [delay],
  )
}
