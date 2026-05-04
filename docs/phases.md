# Brand OS — Bauphasen

## Phase 1 — Fundament & 3D Shell ✓ DONE
**Ziel:** App läuft, sieht richtig aus, 3D Node Graph funktioniert.

- Vite + React 19 + TypeScript strict
- Design Tokens, Fonts, Background + Orbs
- AppHeader, BrandSwitcher, ModeNav, Drawer
- 3D Node Graph (R3F + Bloom + Tunnel)
- Mock-Daten (useBrands), Supabase-Scaffold
- Routing: / → NodeGraph, /brand/:slug → BrandPage + Modi

---

## Phase 2 — Building Mode (Session 1 ✓ DONE, Session 2 ← AKTIV)

**Session 1 ✓**
- localStorage-Persistenz (lib/storage.ts)
- useICPs, useWordBank, usePositioning
- ICPSection + ICPEditor (Drawer)
- WordBankSection (Ja/Nein, Cluster)
- PositioningSection (Statement + Tone)
- Context Export (lib/contextExport.ts + Button)
- Toast-System

**Session 2 ← AKTIV**
- [ ] Business Model Editor (Wer/Was/Wie/Für wen/Womit)
- [ ] Assets (URL + Embed-Preview)
- [ ] SOP Editor (Tiptap)
- [ ] ModeNav: Discovery-Modus ergänzen

---

## Phase 3 — Discovery Mode
**Ziel:** Außenperspektive, automatisch aktualisiert. Informiert Building.

**Discovery Foundation (einmalig)**
- [ ] Markt / Wettbewerber / Nische eingeben
- [ ] Agent analysiert einmalig tief
- [ ] Ergebnis: ICP-Entwürfe, Word-Bank-Vorschläge, Positioning-Ideen
- [ ] User entscheidet was in Building übernommen wird

**Discovery Feed (automatisch, alle X Tage)**
- [ ] Wettbewerber-Monitoring
- [ ] Nischen-Content-Performance (welche Formate laufen)
- [ ] ICP-Suchtrends (was suchen sie gerade)
- [ ] Alle Einträge mit Timestamp — Verlauf sichtbar
- [ ] Wenn Signal stark: Vorschlag → Word Bank / ICP aktualisieren
- [ ] Konfigurierbares Intervall (täglich / wöchentlich / alle 2 Wochen)

---

## Phase 4 — Promo Mode + Tracking
**Ziel:** Content aus Foundation heraus erstellen, taggen, messen.

- [ ] Content-Piece Editor (Tiptap + Auto-Tagging aus Foundation)
- [ ] Kampagnen-Verwaltung
- [ ] Kalender-View (kompakt)
- [ ] Performance-Eingabe (manuell)
- [ ] Instagram Graph API
- [ ] LinkedIn Analytics API
- [ ] Performance-Daten direkt am Content

---

## Phase 5 — Sales CRM
**Ziel:** Leichtes CRM, verbunden mit Promo.

- [ ] Kontakt-Verwaltung
- [ ] Pipeline-View (Kanban, Glass)
- [ ] Follow-up Tracking
- [ ] Verknüpfung Content → Kontakt (Quelle)

---

## Phase 6 — Intelligence + Focus KI
**Ziel:** System lernt, Discovery + Performance + Sales = vollständiger Loop.

- [ ] Focus Tasks (generiert aus allen Modi)
- [ ] Pattern Recognition (Format/ICP/Cluster)
- [ ] ICP-Drift Erkennung (Discovery + Performance kombiniert)
- [ ] Foundation-Anpassungsvorschläge
- [ ] Morning Brief / Notifications
- [ ] Discovery-Feed automatisiert (Cron via Supabase Edge Functions)

---

## Phase 7 — Desktop App
**Ziel:** Tauri-Wrapper.

- [ ] Tauri Setup
- [ ] Native Notifications
- [ ] Offline-Fähigkeit
- [ ] Auto-Update

---

## Später / Optional
- Collaboration (Kommentare, Zuweisung, Review-Status)
- Light Mode
- Mobile View
- Google Analytics, Meta Ads API
- KI-Assistent mit "/" Command im Editor
