import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_EMAIL_SIGNATURES } from '../lib/emailSignature'
import { loadOne, saveOne } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'

const STORAGE_KEY = 'email-signature' as const

export function useEmailSettings(brandSlug: string | undefined) {
  const brandId = useBrandId(brandSlug)
  const [signature, setSignature] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)

  const loadLocal = useCallback(() => {
    if (!brandSlug) return ''
    const stored = loadOne<string>([brandSlug, STORAGE_KEY])
    if (stored?.trim()) return stored
    return DEFAULT_EMAIL_SIGNATURES[brandSlug] ?? ''
  }, [brandSlug])

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setSignature('')
      setLoading(false)
      return
    }
    if (!supabase || !brandId) {
      localOnly.current = true
      setSignature(loadLocal())
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('brands')
      .select('email_signature')
      .eq('id', brandId)
      .maybeSingle()
    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        localOnly.current = true
        setSignature(loadLocal())
      } else {
        setError(err.message)
        setSignature(loadLocal())
      }
      setLoading(false)
      return
    }
    localOnly.current = false
    const sig = (data?.email_signature as string | undefined)?.trim()
    const resolved = sig || DEFAULT_EMAIL_SIGNATURES[brandSlug] || ''
    setSignature(resolved)
    saveOne([brandSlug, STORAGE_KEY], resolved)
    setError(null)
    setLoading(false)
  }, [brandId, brandSlug, loadLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const saveSignature = useCallback(
    async (next: string) => {
      if (!brandSlug) return
      setSignature(next)
      setSaving(true)
      saveOne([brandSlug, STORAGE_KEY], next)
      if (localOnly.current || !supabase || !brandId) {
        setSaving(false)
        return
      }
      const { error: err } = await supabase
        .from('brands')
        .update({ email_signature: next })
        .eq('id', brandId)
      if (err) setError(err.message)
      else setError(null)
      setSaving(false)
    },
    [brandId, brandSlug],
  )

  return { signature, setSignature, saveSignature, loading, saving, error, reload }
}
