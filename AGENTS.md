# AGENTS.md — BLOCK. Studio

## Preferenze comunicazione
- Sono italiano. **Rispondi sempre in italiano**, anche se il codice o i commenti tecnici sono in inglese.
- **Prima di scrivere codice**, verifica se hai compreso le mie intenzioni. Se hai dubbi, fermati e **fammi domande**. Se è tutto chiaro, procedi direttamente alla scrittura del codice.
- **Non sono un programmatore**: tu prendi le decisioni **tecniche** (linguaggi, librerie, architettura, implementazione). **Lascia a me** le decisioni di **prodotto e comportamento** (cosa deve fare, come deve apparire, flussi utente, scelte stilistiche).

---

## Overview progetto
Sito single-page per **BLOCK. Studio** (design studio di East London). Stile: **urbano, minimal, coordinate geografiche come elementi estetici**. Il sito è un unico file `index.html` con CSS e JS inline.

Pubblicato su GitHub Pages da repo `Brakoh/block-studio`.

---

## File structure
```
index.html              — unico file del sito (CSS + HTML + JS)
BustBaseMesh_Decimated.obj  — modello 3D ZBrush in cartella, NON utilizzato
```

---

## Palette
```css
--bg:    #0a0a0a    /* sfondo nero quasi pieno */
--fg:    #e8e8e8    /* testo principale bianco sporco */
--muted: #4c4c4c    /* grigio medio per testi secondari / bordi */
--accent:#c4c4c4    /* grigio chiaro accent */
--dim:   #282828    /* grigio scuro per separatori */
```

Font: `Inter` (corpo), `Space Mono` (coordinate / UI).

---

## Cursore nativo
- Il cursore nativo del PC è **completamente nascosto** su tutto il sito.
- Regola globale: `cursor: none !important` su `body` e su tutti gli elementi interattivi.
- Non usare mai `cursor: pointer`.

---

## Crosshair (cursore custom)
- Elemento `#crosshair`: croce di 24×24 px, linee di 1px in `var(--fg)`.
- `mix-blend-mode: difference`: su sfondo chiaro le linee diventano nere, su sfondo scuro bianche.
- `position: fixed; z-index: 9999;` — sempre sopra tutto.
- Posizionato via JS su ogni `mousemove` (segue il mouse esattamente).
- **Rotazione su hover**: quando il mouse entra dentro un elemento interattivo (bottone, link, etc.), il crosshair aggiunge la classe `.active` e ruota di **180°** con `transition: transform 0.22s cubic-bezier(0.45, 0, 0.55, 1)`. All'uscita torna a 0°.
- Coordinate in basso al centro (`#crosshair-coord`): lat/lng dinamiche basate sulla posizione del mouse.

---

## Linea dinamica (anchor-line)
- Canvas `#anchor-line` (`z-index: 9997`, `pointer-events: none`) copre tutto lo schermo.
- Disegna una **linea curva** dal crosshair fino all'elemento interattivo più vicino, con effetto elastico.
- Disegna anche un rettangolo di hitbox con spaziatura `pad=6` e piccoli angoli alle estremità.
- Usa `clip('evenodd')` per escludere l'area interna dell'hitbox dalla linea (la linea non attraversa l'elemento).
- Sistema di filtro: `interactiveSel = 'a, button, input, select, textarea, [role="link"], .hero h1'`.
- `collectInteractive()` filtra elementi per stato GLOBE (aperto/chiuso) e li mappa in `anchorList`.

---

## Scheda GLOBE
- Overlay a schermo pieno (`#globe-screen`, `position: fixed; inset: 0; z-index: 9000;`), aperto cliccando sul titolo **BLOCK** in hero (`.hero h1`).
- Pulsante Return in alto a sinistra (`#globe-return`) e chiusura con tasto **Escape**.
- Al caricamento `history.scrollRestoration = 'manual'` e `window.scrollTo(0, 0)` per partire sempre dall'alto al refresh.

### Sfera 3D (p5.js WEBGL)
- Canvas `#face-canvas` (`z-index: 9001`, `pointer-events: none`).
- Sfera procedurale di punti (~2600 punti) con **~110 linee randomiche attive** che collegano punti vicini e si rigenerano dinamicamente.
- La sfera **segue leggermente il cursore**: parametri `sway: 0.18`, `follow: 0.04` (movimento molto contenuto).
- Al click su BLOCK, la sfera si **resetta**: `rotY = 0`, `rotX = 0`, linee svuotate e rigenerate.
- **Proiezione manuale**: NON usare `screenX/screenY/screenZ` di p5 (crashano/bloccano il draw loop). La proiezione 2D dei DOM elementi agganciati alla sfera viene calcolata manualmente applicando le stesse rotazioni `rotateY(rotY)` + `rotateX(rotX + 0.12)` e poi proiezione prospettica con fov 60° (`f = (height/2)/tan(PI/6)`).

### Pulsante MEME
- Tasto `.globe-tag` (#globe-tag) ancorato al punto **D4** della griglia coordinate_globe.
- Posizionato con proiezione manuale, `z-index: 9007` (sopra canvas e coordinate).
- **Hover**: fondo nero riempito da **macchia bianca che sale dal basso** (`translateY(100%) → 0`), con clip-path a singola onda che a fine corsa copre interamente il rettangolo (tutti i punti sopra il bordo superiore). Testo MEME inverte colore da bianco a nero.
- Se la sfera ruota e il punto finisce dietro, il pulsante si nasconde (`display: none`).

### Coordinate GLOBE (coordinate_globe)
- Griglia temporanea di **96 etichette** (`A1`…`H12`) distribuite uniformemente sulla sfera come riferimento.
- Elementi DOM `.coord-globe` (`z-index: 9005`), creati dinamicamente in `setup()`.
- Proiezione manuale come MEME, nascoste quando il punto è dietro la sfera (`lz2 >= f`) o quando GLOBE è chiuso.

---

## Convenzioni tecniche
- **Single-file**: tutto CSS e JS sono inline in `index.html`.
- **p5.js WEBGL**: caricato da CDN (`1.9.4`). Il secondo `<script>` contiene la sfera.
- **JS scope**: il primo script gestisce UI/interattività/linea, il secondo gestisce p5 (globo).
- **Comunicazione tra script**: `window.resetGlobe` esposta dallo script p5, chiamata da `openGlobe()` nello script UI.
- **Transizioni CSS**: usare `cubic-bezier(0.45, 0, 0.55, 1)` o `cubic-bezier(0.55, 0, 0.25, 1)` per movimenti gentle/morbidi.
- **No git push**: **NON fare push su GitHub** finché l'utente non lo chiede esplicitamente.
- **No `screenX/Y/Z` in p5 WEBGL**: usare sempre la proiezione manuale (vedi codice esistente nel draw).

---

## Flussi principali
| Azione | Effetto |
|--------|---------|
| Click su **BLOCK** (hero) | Apre GLOBE, resetta sfera, linee ripartono |
| Click **Return** o tasto **Esc** | Chiude GLOBE |
| Mouse su elemento interattivo | Crosshair ruota 180°, linea curva si aggancia, hitbox appare |
| Mouse fuori da elementi | Linea si retrae verso il cursore, hitbox scompare |
| Hover su MEME | Macchia bianca sale riempiendo il bottone, testo inverte |
