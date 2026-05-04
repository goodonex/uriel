/**
 * Brand OS — Kunden einladen (Placeholder)
 *
 * TODO: Supabase Edge Function mit Service Role:
 * - inviteClient({ email, projectId }) → admin.createUser({ email, email_confirm: true })
 * - In user_roles für die neue user_id: role='client', project_id=<projectId>
 * - Optional: Resend / SendGrid für Einladungs-Mail
 *
 * NICHT vom Browser mit anon key aufrufen — nur serverseitig (Dashboard, CLI, CI).
 */
Deno.serve(() => {
  return new Response(
    JSON.stringify({
      ok: false,
      error: 'invite-client not implemented — see TODO in supabase/functions/invite-client/index.ts',
    }),
    { status: 501, headers: { 'Content-Type': 'application/json' } },
  )
})
