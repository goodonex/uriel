-- Pipeline stage: follow_up (eigene Kanban-Spalte zwischen Gespräch und Pitch)

alter table contacts drop constraint if exists contacts_pipeline_stage_check;

alter table contacts add constraint contacts_pipeline_stage_check
  check (pipeline_stage in (
    'first_contact',
    'conversation',
    'follow_up',
    'proposal',
    'deal',
    'paused'
  ));
