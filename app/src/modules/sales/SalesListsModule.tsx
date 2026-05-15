import { useParams } from 'react-router-dom'
import { ContactListsContent } from '../../pages/sales/ContactListsContent'

export function SalesListsModule() {
  const { slug = '' } = useParams<{ slug: string }>()
  return <ContactListsContent slug={slug} embedded />
}
