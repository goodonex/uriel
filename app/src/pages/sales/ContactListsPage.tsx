import { useParams } from 'react-router-dom'
import { ContactListsContent } from './ContactListsContent'

export function ContactListsPage() {
  const { slug, listId } = useParams<{ slug: string; listId?: string }>()
  if (!slug) return null
  return <ContactListsContent slug={slug} listId={listId} embedded={false} />
}
