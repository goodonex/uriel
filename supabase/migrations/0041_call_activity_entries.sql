-- Call Sequencer: Anruf-Outcomes als activity_entries (activity_type = call)

alter table activity_entries drop constraint if exists activity_entries_activity_type_check;
alter table activity_entries add constraint activity_entries_activity_type_check
  check (activity_type in (
    'presetting', 'setting', 'closing', 'terminierung',
    'unqualified', 'noshow', 'followup', 'formular', 'notiz',
    'call'
  ));

comment on column activity_entries.data is
  'Typ-spezifisches JSON; call: { outcome, note, next_action }';
