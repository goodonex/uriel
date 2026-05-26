import type { SalesEmailTemplate } from '../types/db'

export const DEFAULT_EMAIL_TEMPLATE_SEEDS: Array<
  Pick<SalesEmailTemplate, 'name' | 'subject' | 'body'>
> = [
  {
    name: 'Nicht Erreicht',
    subject: 'Kurze Nachricht von {{anrede}}',
    body: 'Hallo {{name}},\n\nich habe Sie gerade telefonisch nicht erreicht. Wann passt ein kurzer Rückruf?\n\nViele Grüße',
  },
  {
    name: 'Termin verpasst',
    subject: 'Neuer Terminvorschlag',
    body: 'Hallo {{name}},\n\nleider konnten wir unseren Termin nicht wahrnehmen. Passt Ihnen ein neuer Termin am {{datum}}?\n\nViele Grüße',
  },
  {
    name: 'Falsche Nummer',
    subject: 'Rückfrage zu Ihrer Kontaktaufnahme',
    body: 'Guten Tag,\n\nich konnte Sie unter der hinterlegten Nummer nicht erreichen. Können Sie mir eine erreichbare Nummer nennen?\n\nViele Grüße',
  },
  {
    name: 'Selbstauskunft',
    subject: 'Unterlagen zur Vorbereitung',
    body: 'Hallo {{name}},\n\nanbei / im Anhang finden Sie die Selbstauskunft zur Vorbereitung unseres Gesprächs.\n\nViele Grüße',
  },
]
