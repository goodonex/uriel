# Brand OS — Cursor Rules
# Diese Datei wird bei jeder Anfrage automatisch gelesen.

## Was wir bauen
Brand OS — ein lernendes Betriebssystem für Personal Brands.
Kein generisches Dashboard. Ein räumliches, glasbasiertes UI mit 3D-Elementen.
Zielnutzer: Kevin, solo-Unternehmer mit 3 Brands (Herrmann & Co., Offmarketbude, Homeflower).

## Tech Stack (nicht abweichen ohne Rückfrage)
- React 18 + Vite
- TypeScript (strict)
- Tailwind CSS (nur als Utility-Basis — Custom Design via tokens.css)
- React Three Fiber + Drei (3D Node Graph)
- Framer Motion (Übergänge, Animationen)
- Zustand (State Management — kein Redux)
- Tiptap (Editor in Drawern)
- Supabase (Auth + DB + Storage + Realtime)
- React Router v6

## Design-Regeln (immer einhalten)
- Design-Tokens aus `/design/tokens.css` — IMMER nutzen, nie hart kodieren
- Glas-Ästhetik: backdrop-filter blur, rgba-Hintergründe, dünne Borders
- Hintergrund: #080810 mit Orbs (blur 80px, opacity 0.15)
- Fonts: Syne (Display), DM Sans (Body), JetBrains Mono (Data/Labels)
- Kein helles Theme (noch nicht)
- Referenz-Komponenten: `/design/components.html`
- Keine Standard-Tailwind-Optik — immer gegen components.html prüfen

## Datenbankstruktur
Vollständiges Schema in `/docs/data-model.md`.
Jede neue Tabelle oder Änderung dort dokumentieren.

## Architektur-Logik
Vollständige Systemlogik in `/docs/system.md`.
Bei Unklarheiten über Features oder Logik — dort nachschlagen, nicht erfinden.

## Code-Stil
- Komponenten: Functional, keine Class Components
- Kleine fokussierte Komponenten (max ~150 Zeilen)
- Custom Hooks für Logic (useICP, useContentPiece, useFocusTasks etc.)
- Supabase-Calls nur in Hooks oder Service-Dateien, nie direkt in Komponenten
- Fehler immer behandeln (try/catch + user-facing Error States)
- Loading States für alle async Operationen

## Ordnerstruktur App
```
app/src/
  components/     -- Wiederverwendbare UI-Komponenten
  hooks/          -- Custom React Hooks
  lib/            -- Supabase Client, Utils, Helpers
  pages/          -- Route-Level Komponenten
  store/          -- Zustand Stores
  three/          -- Three.js / R3F Komponenten
  types/          -- TypeScript Typen (aus data-model.md)
```

## Was NICHT gemacht wird
- Kein Light Mode (Phase 1–3)
- Kein vollständiger Kalender
- Keine Buchhaltung
- Keine Dateiablage (nur Links/Embeds)
- Keine komplexen Animationen bevor die Grundfunktion steht

## Aktuelle Phase
Siehe `/docs/phases.md` — immer prüfen welche Phase aktiv ist.
Nichts aus späteren Phasen vorziehen ohne explizite Anfrage.
