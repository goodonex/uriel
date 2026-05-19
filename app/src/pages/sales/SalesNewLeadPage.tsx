import { useNavigate, useParams } from 'react-router-dom'
import { NewLeadWizardModal } from '../../components/sales/NewLeadWizardModal'
import { useToast } from '../../components/Toast'
import { useContacts } from '../../hooks/useContacts'

export function SalesNewLeadPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const contacts = useContacts(slug)
  const { show: showToast } = useToast()

  return (
    <NewLeadWizardModal
      open
      onClose={() => navigate(`/brand/${slug}/sales`)}
      existingContacts={contacts.items}
      onSubmit={async ({ company, person }, options) => {
        const r1 = await contacts.create(company, {
          skipDuplicateCheck: options?.skipDuplicateCheck ?? false,
        })
        if (!r1.ok) {
          showToast('Firma konnte nicht angelegt werden', 'error')
          return
        }
        const r2 = await contacts.create(
          { ...person, parent_company_id: r1.contact.id },
          { skipDuplicateCheck: options?.skipDuplicateCheck ?? false },
        )
        if (r1.syncWarning || (r2.ok && r2.syncWarning)) {
          showToast('Lokal gespeichert (Sync-Hinweis)', 'info')
        }
        navigate(`/brand/${slug}/sales/${r1.contact.id}`)
      }}
    />
  )
}
