-- Brand OS — Discovery Agent (Status, Feed-Archiv)

alter table discovery_foundation
  add column if not exists analysis_status text not null default 'idle';

alter table discovery_foundation
  drop constraint if exists discovery_foundation_analysis_status_check;

alter table discovery_foundation
  add constraint discovery_foundation_analysis_status_check
  check (analysis_status in ('idle', 'running', 'complete', 'error'));

comment on column discovery_foundation.analysis_status is 'idle | running (optional) | complete | error';

alter table discovery_feed_items
  add column if not exists archived_at timestamptz;

create index if not exists discovery_feed_items_brand_active_idx
  on discovery_feed_items (brand_id, recorded_at desc)
  where archived_at is null;
