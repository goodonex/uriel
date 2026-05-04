# Brand OS — Visual Reference

## Ästhetik-Richtung
Dark glass. Räumliche Tiefe. Minimal aber lebendig.
Kein generisches Dashboard. Kein Tailwind-Standard-Look.

## Referenzen (Gefühl, nicht Kopie)
- **Linear.app** — Geschwindigkeit, Reduktion, keyboard-first
- **Resend.com** — Glas auf Dunkel, Typografie, Luft
- **Arc Browser** — räumliche Navigation, Tiefe
- **Spline.design** — 3D im Web-Kontext, wie Nodes sich anfühlen sollen
- **Vercel Dashboard** — Dark theme done right, Dichte ohne Chaos

## Typografie
- Display / Headings: **Syne** (Google Fonts) — geometrisch, eigenständig
- Body / UI: **DM Sans** — lesbar, warm, nicht generisch
- Mono / Data: **JetBrains Mono** — für Keys, Labels, Code

## Glas-Prinzip
Vier Ebenen, jede eine Stufe näher:
- glass-1: `rgba(255,255,255,0.04)` — hover, subtilste Fläche
- glass-2: `rgba(255,255,255,0.07)` — Cards, Panels
- glass-3: `rgba(255,255,255,0.11)` — Drawer, Modals
- glass-4: `rgba(255,255,255,0.15)` — aktiv, selektiert

Immer mit `backdrop-filter: blur(16px–28px)` und dünnem Border.
Nie opaque. Nie ohne Blur.

## Hintergrund
Kein Schwarz. `#080810` — tiefstes Dunkelblau.
Zwei bis drei große Orbs (blur: 80px, opacity: 0.15–0.20):
- Blau oben links: `#4f7fff`
- Lila unten rechts: `#8b5cf6`
- Optional Teal Mitte: `#2dd4bf`

Diese Orbs geben Tiefe ohne Ablenkung.

## 3D Node Graph (Three.js / React Three Fiber)
- Nodes als Kugeln, leicht glow, nicht zu groß
- Brand-Nodes: größer (~80px), heller Kern, Glow-Ring
- Connections: dünne Linien, opacity 0.3, leicht animiert (pulse)
- Kamera: leichte Parallax bei Mouse-Move
- Tunnel-Effekt beim Reinfliegen: FOV-Zoom + Bloom-Post-Processing
- Hintergrund: Starfield (wenige Punkte, sehr subtil)

## Animationen
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` — smooth ease-out
- Enter-Animationen: staggered, 60–80ms zwischen Elementen
- Hover: `translateY(-1px)` + border-color-shift, keine Scale
- Übergänge zwischen Modi: Framer Motion `layoutId` für shared elements
- Kein Bounce, kein Overshoot — außer bei 3D-Nodes (leicht spring)

## Farben pro Modus
- Building:     `#4f7fff` (Blau)
- Promo:        `#8b5cf6` (Lila)
- Sales:        `#2dd4bf` (Teal)
- Intelligence: `#f59e0b` (Amber)

Jeder Modus hat einen subtilen Glow-Akzent in seiner Farbe.

## Was NICHT gemacht wird
- Keine hellen Themes (Light Mode kommt später, wenn überhaupt)
- Kein Inter, kein Roboto, kein System-Font
- Keine Boxen mit hartem weißem Hintergrund
- Keine Sidebar mit Icons und Labels (Standard-Dashboard-Pattern)
- Kein Hamburger-Menü
- Keine Tabellen-Listen für Assets oder Content
