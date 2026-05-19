import { useParams } from 'react-router-dom'
import { PostCallModal } from '../../components/sales/PostCallModal'
import { ContactPage } from '../../pages/sales/ContactPage'
import { PostCallFlowProvider } from '../../hooks/usePostCallFlow'

export function ContactDetailModule() {
  const { slug = '' } = useParams<{ slug: string }>()
  return (
    <PostCallFlowProvider>
      <ContactPage variant="page" />
      {slug ? <PostCallModal brandSlug={slug} /> : null}
    </PostCallFlowProvider>
  )
}
