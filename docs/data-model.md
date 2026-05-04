# Brand OS — Data Model

## Stack
- Database: Supabase (PostgreSQL)
- Auth: Supabase Auth
- Realtime: Supabase Realtime (für Live-Updates)
- Storage: Supabase Storage (nur für Uploads wie Logos)

---

## Core Tables

### brands
```sql
id            uuid PK
user_id       uuid FK (auth.users)
name          text
slug          text unique
color         text          -- hex, Modus-Akzentfarbe
created_at    timestamp
```

### foundation_icps
```sql
id            uuid PK
brand_id      uuid FK
name          text          -- "Urban Professional"
age_range     text          -- "28–42"
location      text
pain_points   text[]
word_clusters text[]        -- Referenz auf word_bank clusters
priority      int           -- 1=primary, 2=secondary, 3=tertiary
notes         text
```

### foundation_word_bank
```sql
id            uuid PK
brand_id      uuid FK
word          text
type          text          -- 'yes' | 'no'
cluster       text          -- Gruppenname z.B. "Ritual", "Qualität"
```

### foundation_positioning
```sql
id            uuid PK
brand_id      uuid FK
statement     text
tone_of_voice text
business_model jsonb        -- { who, what, how, for_whom, revenue }
updated_at    timestamp
```

### assets
```sql
id            uuid PK
brand_id      uuid FK
type          text          -- 'website' | 'instagram' | 'linkedin' | 'document' | 'lead_magnet'
name          text
url           text
embed_url     text          -- für iframe embed
api_connected boolean
api_config    jsonb         -- { platform, token, account_id }
created_at    timestamp
```

### sops
```sql
id            uuid PK
brand_id      uuid FK
title         text
content       text          -- Tiptap JSON
category      text          -- 'workflow' | 'template' | 'process'
```

---

## Promo Tables

### content_pieces
```sql
id            uuid PK
brand_id      uuid FK
title         text
body          text          -- Tiptap JSON
status        text          -- 'draft' | 'scheduled' | 'live' | 'archived'
format        text          -- 'post' | 'reel' | 'story' | 'email' | 'article' | 'ad'
channel       text          -- 'instagram' | 'linkedin' | 'email' | 'website'
goal          text          -- 'awareness' | 'lead' | 'sale' | 'nurture'
scheduled_at  timestamp
published_at  timestamp
campaign_id   uuid FK nullable

-- Tags (Intelligence-Grundlage, KRITISCH)
icp_ids       uuid[]        -- Welche ICPs angesprochen
word_clusters text[]        -- Welche Word-Bank-Cluster dominant
```

### content_performance
```sql
id            uuid PK
content_id    uuid FK
source        text          -- 'manual' | 'instagram_api' | 'linkedin_api' | 'meta_api'
impressions   int
reach         int
clicks        int
saves         int
leads         int
conversions   int
revenue       numeric
notes         text
recorded_at   timestamp
```

### campaigns
```sql
id            uuid PK
brand_id      uuid FK
name          text
goal          text
start_date    date
end_date      date
status        text          -- 'planning' | 'active' | 'done'
```

---

## Sales Tables

### contacts
```sql
id            uuid PK
brand_id      uuid FK
name          text
email         text
company       text
source        text          -- 'organic' | 'ad' | 'referral' | 'event'
source_content_id uuid FK nullable  -- welcher Content hat ihn gebracht
pipeline_stage text         -- 'lead' | 'contact' | 'meeting' | 'offer' | 'deal' | 'pause'
last_contact  date
next_action   text
notes         text
created_at    timestamp
```

---

## Intelligence Tables

### intelligence_patterns
```sql
id            uuid PK
brand_id      uuid FK
type          text          -- 'content_format' | 'icp_drift' | 'channel_strength' | 'pipeline_block'
insight       text          -- Lesbare Zusammenfassung
data          jsonb         -- Rohdaten die zum Schluss geführt haben
confidence    float         -- 0–1
suggested_action text
status        text          -- 'new' | 'accepted' | 'rejected' | 'deferred'
created_at    timestamp
```

### focus_tasks
```sql
id            uuid PK
brand_id      uuid FK
text          text
reason        text
impact        text          -- 'high' | 'medium' | 'low'
mode          text          -- 'building' | 'promo' | 'sales' | 'intelligence'
target_id     uuid nullable -- ID des betroffenen Objekts
target_type   text nullable -- 'icp' | 'content' | 'contact' | 'asset'
completed_at  timestamp nullable
deferred_at   timestamp nullable
created_at    timestamp
```

---

## Context Export (generiert, nicht gespeichert)
Wird on-demand aus den Foundation-Tabellen zusammengebaut.
Format: strukturiertes Markdown.

```
BRAND: {name}
POSITIONING: {statement}
TONE: {tone_of_voice}
BUSINESS_MODEL: {business_model.summary}
ICP_PRIMARY: {icp[0].name} · {icp[0].age_range} · {icp[0].location}
ICP_PRIMARY_PAIN: {icp[0].pain_points.join(', ')}
ICP_SECONDARY: {icp[1].name} ...
WORD_BANK_YES: {word_bank.filter(yes).map(w => w.word).join(' · ')}
WORD_BANK_NO: {word_bank.filter(no).map(w => w.word).join(' · ')}
ACTIVE_CHANNELS: {assets.filter(api_connected).map(a => a.type).join(', ')}
CURRENT_FOCUS: {focus_tasks.filter(high_impact).map(t => t.text).join(' · ')}
```
