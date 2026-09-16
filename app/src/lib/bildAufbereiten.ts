/**
 * Bilder aus dem Kundenportal annehmbar machen, bevor sie auf die Website gehen.
 *
 * Vorher nahm der Upload alles: `accept="image/*"` ist nur ein Vorschlag im
 * Dateidialog, und die Ablage lässt bis 10 MB durch. Zwei Dinge gingen damit
 * regelmäßig schief — beide auf der LIVE-Seite, beide für den Kunden unsichtbar,
 * weil sein eigenes Gerät das Bild klaglos anzeigt:
 *
 *   1. **HEIC.** Das Standardformat der iPhone-Kamera. Safari zeigt es, Chrome
 *      und Firefox nicht — der Kunde sieht sein Bild, seine Besucher ein
 *      kaputtes Symbol. Umwandeln kann der Browser es nicht (er kann es nicht
 *      einmal dekodieren), deshalb wird es hier abgelehnt, mit der Anleitung,
 *      die auf einem iPhone tatsächlich funktioniert.
 *   2. **Größe.** Ein Foto direkt aus der Kamera hat gut 4000 Pixel Breite und
 *      mehrere Megabyte. Auf einer Maklerseite braucht es nie mehr als 2400.
 *      Das rechnen wir hier herunter, statt es dem Kunden zu erklären.
 *
 * SVG ist ausgeschlossen: Eine SVG-Datei kann Skript enthalten und läge danach
 * unter der Adresse der Kundenwebsite.
 */

/** Längste Kante, die eine Kundenseite je braucht. */
export const MAX_KANTE = 2400
/** Ab hier wird neu gerechnet, auch wenn die Abmessungen passen. */
export const RECHNE_AB_BYTES = 1_500_000
/** Harte Grenze nach dem Herunterrechnen. */
export const MAX_BYTES = 8_000_000

const ERLAUBT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']

export type BildErgebnis = { ok: true; datei: File } | { ok: false; grund: string }

const HEIC_HINWEIS =
  'Das ist ein iPhone-Foto im HEIC-Format — viele Browser können es nicht anzeigen. ' +
  'Einfachster Weg: Auf dem iPhone unter Einstellungen → Kamera → Formate auf ' +
  '„Maximale Kompatibilität" stellen und das Foto neu aufnehmen. Oder das Bild in ' +
  '„Fotos" öffnen, auf Teilen tippen und dort in eine Mail oder Notiz legen — dabei ' +
  'wird es automatisch umgewandelt.'

/** Nur am Namen erkennbar: Safari meldet HEIC teils mit leerem Typ. */
function istHeic(datei: File): boolean {
  const typ = (datei.type || '').toLowerCase()
  if (typ === 'image/heic' || typ === 'image/heif') return true
  return /\.(heic|heif)$/i.test(datei.name)
}

export function pruefeBild(datei: File): { ok: true } | { ok: false; grund: string } {
  if (istHeic(datei)) return { ok: false, grund: HEIC_HINWEIS }
  const typ = (datei.type || '').toLowerCase()
  if (typ === 'image/svg+xml' || /\.svgz?$/i.test(datei.name)) {
    return { ok: false, grund: 'SVG-Dateien nehmen wir hier nicht an. Schick sie uns kurz, wir setzen sie ein.' }
  }
  if (!ERLAUBT.includes(typ)) {
    return {
      ok: false,
      grund: 'Das ist kein Bild, das wir einsetzen können. JPG, PNG oder WebP funktionieren.',
    }
  }
  return { ok: true }
}

function neuerName(name: string, endung: string): string {
  return name.replace(/\.[^.]+$/, '') + endung
}

/**
 * Prüfen und, wenn nötig, herunterrechnen. Animierte GIFs bleiben unangetastet —
 * über die Zeichenfläche käme nur das erste Einzelbild zurück.
 */
export async function bildAufbereiten(datei: File): Promise<BildErgebnis> {
  const pruefung = pruefeBild(datei)
  if (!pruefung.ok) return pruefung

  const typ = (datei.type || '').toLowerCase()
  if (typ === 'image/gif') {
    return datei.size > MAX_BYTES
      ? { ok: false, grund: 'Die Datei ist zu groß. Bitte ein kleineres Bild wählen.' }
      : { ok: true, datei }
  }

  let bild: ImageBitmap
  try {
    bild = await createImageBitmap(datei)
  } catch {
    return { ok: false, grund: 'Das Bild lässt sich nicht öffnen. Versuch es mit einer JPG- oder PNG-Datei.' }
  }

  const laengste = Math.max(bild.width, bild.height)
  const mussKleiner = laengste > MAX_KANTE
  const mussLeichter = datei.size > RECHNE_AB_BYTES

  if (!mussKleiner && !mussLeichter) {
    bild.close()
    return { ok: true, datei }
  }

  const faktor = mussKleiner ? MAX_KANTE / laengste : 1
  const breite = Math.max(1, Math.round(bild.width * faktor))
  const hoehe = Math.max(1, Math.round(bild.height * faktor))

  const flaeche = document.createElement('canvas')
  flaeche.width = breite
  flaeche.height = hoehe
  const stift = flaeche.getContext('2d')
  if (!stift) {
    bild.close()
    return { ok: true, datei }
  }
  stift.drawImage(bild, 0, 0, breite, hoehe)
  bild.close()

  // PNG behält seinen durchsichtigen Hintergrund (Logos!), alles andere wird JPG.
  const zielTyp = typ === 'image/png' ? 'image/png' : 'image/jpeg'
  const klecks = await new Promise<Blob | null>((fertig) =>
    flaeche.toBlob(fertig, zielTyp, zielTyp === 'image/jpeg' ? 0.85 : undefined),
  )

  if (!klecks) return { ok: true, datei }
  if (klecks.size > MAX_BYTES) {
    return { ok: false, grund: 'Die Datei ist auch verkleinert noch zu groß. Bitte ein kleineres Bild wählen.' }
  }
  // Größer geworden kommt bei kleinen PNG vor — dann das Original behalten.
  if (klecks.size >= datei.size && !mussKleiner) return { ok: true, datei }

  const endung = zielTyp === 'image/png' ? '.png' : '.jpg'
  return { ok: true, datei: new File([klecks], neuerName(datei.name, endung), { type: zielTyp }) }
}
