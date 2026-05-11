import { useParams } from 'react-router-dom'
import { ModeContextStrip } from '../../components/ModeContextStrip'
import { ContactListsContent } from './ContactListsContent'

export function ContactListsPage() {
  const { slug, listId } = useParams<{ slug: string; listId?: string }>()
  if (!slug) return null
  return (
    <>
      <ModeContextStrip slug={slug} />
      <ContactListsContent slug={slug} listId={listId} embedded={false} />
    </>
  )
}
