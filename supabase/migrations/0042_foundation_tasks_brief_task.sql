-- Brief-Tasks (Call Sequencer / DirectMailing-Export)

alter table foundation_tasks drop constraint if exists foundation_tasks_source_check;
alter table foundation_tasks add constraint foundation_tasks_source_check
  check (source in ('manual', 'follow_up', 'system', 'onboarding', 'brief_task'));
