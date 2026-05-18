/** JSON body from Edge Functions on non-2xx (FunctionsHttpError.context). */
export type EdgeFnErrorBody = {
  ok?: boolean
  message?: string
  code?: string
  docsPath?: string
}

export async function readInvokeErrorBody(err: unknown): Promise<EdgeFnErrorBody | null> {
  if (!err || typeof err !== 'object') return null
  const ctx = (err as { context?: Response }).context
  if (ctx && typeof ctx.clone === 'function' && typeof ctx.json === 'function') {
    try {
      return (await ctx.clone().json()) as EdgeFnErrorBody
    } catch {
      try {
        const text = await ctx.clone().text()
        return text ? { message: text.slice(0, 400) } : null
      } catch {
        return null
      }
    }
  }
  return null
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} (Timeout nach ${Math.round(ms / 1000)}s)`)), ms)
    promise
      .then((v) => {
        clearTimeout(t)
        resolve(v)
      })
      .catch((e) => {
        clearTimeout(t)
        reject(e)
      })
  })
}
