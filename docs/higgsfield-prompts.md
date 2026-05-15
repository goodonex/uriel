# Higgsfield — Texture Prompts (Visual Polish)

Stand: `feat/visual-polish` · Assets unter `app/public/textures/`.

## MCP-Status bei Generierung

Higgsfield MCP lieferte **„Invalid or expired token“** — alle aktuellen Dateien wurden mit dem prozeduralen Fallback-Skript erzeugt:

```bash
python3 app/scripts/generate-fallback-textures.py
```

Nach Token-Renewal die Prompts unten 1:1 in `generate_image` nutzen, `job_status` pollen, `results.rawUrl` nach `public/textures/` laden.

Empfohlenes Modell (nach `models_explore`): `nano_banana_2` · Aspect Ratio `16:9` oder `1:1`.

---

## Planeten — Basis-Template

```
abstract planetary surface texture, monochromatic grayscale,
seamless tileable pattern, high detail terrain elevation map,
no logos, no text, no recognizable objects,
seamless edge transitions, equirectangular projection style,
detailed displacement information for 3D rendering,
[PATTERN]
```

| Brand | Datei | Pattern-Zusatz |
|-------|-------|----------------|
| Herrmann & Co. | `planets/herrmann_surface.jpg` | smooth flowing organic patterns, like calm ocean swells from above |
| Wertavio | `planets/wertavio_surface.jpg` | crystalline mineral structures, geometric fractal-like formations |
| CultureFit | `planets/culturefit_surface.jpg` | volcanic ridges and fault lines, dynamic flowing magma channels |
| Homeflower | `planets/homeflower_surface.jpg` | dense organic forest canopy from above, layered biome textures |
| Eversmell | `planets/eversmell_surface.jpg` | sharp angular geological strata, crystalline desert dune patterns |

### Vollständige Prompts (Beispiel Herrmann)

```
abstract planetary surface texture, monochromatic grayscale,
seamless tileable pattern, high detail terrain elevation map,
no logos, no text, no recognizable objects,
seamless edge transitions, equirectangular projection style,
detailed displacement information for 3D rendering,
smooth flowing organic patterns, like calm ocean swells from above
```

Retry-Hinweis bei farbigem/fotorealistischem Output:

```
grayscale only, displacement height map, no planet sphere in frame,
no color, seamless tileable bump map texture
```

Max. 2 Retries pro Brand, danach prozeduraler Fallback.

---

## Mond

**Datei:** `moon/moon_surface.jpg`

```
detailed lunar surface texture, monochromatic grayscale,
realistic crater field with varied sizes,
high detail elevation map, terrain displacement information,
seamless tileable pattern, no recognizable features or logos,
photographic moon surface, 2048x1024 equirectangular projection
```

---

## Stern-Glow

**Datei:** `glow/star_glow.png`

```
radial light glow effect, soft circular gradient,
center bright white core fading to fully transparent edges,
no background, transparent PNG,
isolated atmospheric halo, no color tint, pure white luminance,
1024x1024 square format with transparent background
```

Falls kein Alpha: radialer Canvas-Gradient (implementiert in `generate-fallback-textures.py` → `write_glow`).

---

## Three.js-Verwendung

Texturen werden **nicht** als `map` (Albedo) genutzt, sondern als `bumpMap` + `roughnessMap`. Brand-Primärfarbe bleibt `color` am `meshStandardMaterial`.

Siehe [`docs/visual-system.md`](visual-system.md).
