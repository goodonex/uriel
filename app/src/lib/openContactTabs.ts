import { useWorkspaceTabs } from '../store/workspaceTabs'
import { contactSalesPath } from './workspaceTabs'

export { contactSalesPath }

export function openContactInNewTab(
  slug: string,
  contactId: string,
  opts?: { activate?: boolean },
): void {
  useWorkspaceTabs.getState().openTab(slug, contactSalesPath(slug, contactId), {
    activate: opts?.activate ?? false,
  })
}

export function openContactsInTabs(
  slug: string,
  contactIds: string[],
): { opened: number; blocked: number } {
  const paths = contactIds.map((id) => contactSalesPath(slug, id))
  return useWorkspaceTabs.getState().openMany(slug, paths, { activateIndex: 0 })
}
