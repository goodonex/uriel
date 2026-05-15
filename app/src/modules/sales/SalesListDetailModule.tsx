import { useParams } from 'react-router-dom'
import { ContactListsContent } from '../../pages/sales/ContactListsContent'

export function SalesListDetailModule() {
  const { slug = '', listId } = useParams<{ slug: string; listId?: string }>()
  if (!listId) return null
  return <ContactListsContent slug={slug} listId={listId} embedded />
}
