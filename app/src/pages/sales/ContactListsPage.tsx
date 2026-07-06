import { useParams } from 'react-router-dom'
import { useCurrentBrandSlug } from '../../hooks/useCurrentBrandSlug'
import { ContactListsContent } from './ContactListsContent'

export function ContactListsPage() {
  const { listId } = useParams<{ listId?: string }>()
  const slug = useCurrentBrandSlug()
  if (!slug) return null
  return <ContactListsContent slug={slug} listId={listId} embedded={false} />
}
