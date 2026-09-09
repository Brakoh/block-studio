# AGENTS.md — BLOCK. Studio

## Preferenze comunicazione
- Sono italiano. **Rispondi sempre in italiano**, anche se il codice o i commenti tecnici sono in inglese.
- **Prima di scrivere codice**, verifica se hai compreso le mie intenzioni. Se hai dubbi, fermati e **fammi domande**. Se è tutto chiaro, procedi direttamente alla scrittura del codice.
- **Non sono un programmatore**: tu prendi le decisioni **tecniche** (linguaggi, librerie, architettura, implementazione). **Lascia a me** le decisioni di **prodotto e comportamento** (cosa deve fare, come deve apparire, flussi utente, scelte stilistiche).

---

## Overview progetto
Sito per **BLOCK. Studio** (design studio di East London). Stile: **urbano, minimal, coordinate geografiche come elementi estetici**. Ogni pagina è un HTML autonomo con CSS e JS inline.

Pubblicato su GitHub Pages da repo `Brakoh/block-studio`.

---

## File structure
```
index.html                  — home (CSS + HTML + JS)
globe.html                  — pagina GLOBE (sfera p5, MEME, Return)
dr_strange.html             — telaio grafico isolato, non linkato dalla home
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
- `collectInteractive()` mappa gli elementi visibili in `anchorList`.
- Su `globe.html` la linea si aggancia **solo in hover** (niente magnete verso la sfera).

---

## Pagina GLOBE (`globe.html`)
- Pagina autonoma, aperta cliccando sul titolo **BLOCK** in hero (`.hero h1`) → `globe.html`.
- Pulsante Return in alto a sinistra (`#globe-return`) e tasto **Escape** tornano a `index.html`.
- Al caricamento della home `history.scrollRestoration = 'manual'` e `window.scrollTo(0, 0)` per partire sempre dall'alto al refresh.

### Sfera 3D (p5.js WEBGL)
- Canvas `#face-canvas` (`z-index: 9001`, `pointer-events: none`), visibile per tutta la pagina.
- Sfera procedurale di punti (~2600 punti).
- La sfera **segue leggermente il cursore**: parametri `sway: 0.18`, `follow: 0.04` (movimento molto contenuto).
- Al caricamento di `globe.html` la sfera parte da `rotY = 0`, `rotX = 0`, linee generate in `setup()`.
- Linee **curve** (~140) tra punti vicini, con vita e coda; gli estremi sono `a.x/y/z`.
- MEME e `.coord-globe` usano la proiezione manuale sulle posizioni di riposo. Nascosti quando `lz2 >= f`.
- **Proiezione manuale**: NON usare `screenX/screenY/screenZ` di p5 (crashano/bloccano il draw loop). La proiezione 2D dei DOM elementi agganciati alla sfera viene calcolata manualmente applicando le stesse rotazioni `rotateY(rotY)` + `rotateX(rotX + 0.12)` e poi proiezione prospettica con fov 60° (`f = (height/2)/tan(PI/6)`).

### Pulsante MEME
- Tasto `.globe-tag` (#globe-tag) ancorato al punto **D4** della griglia coordinate_globe.
- Posizionato con proiezione manuale, `z-index: 9007` (sopra canvas e coordinate).
- **Hover**: fondo nero riempito da **macchia bianca che sale dal basso** (`translateY(100%) → 0`), con clip-path a singola onda che a fine corsa copre interamente il rettangolo (tutti i punti sopra il bordo superiore). Testo MEME inverte colore da bianco a nero.
- Se la sfera ruota e il punto finisce dietro, il pulsante si nasconde (`display: none`).

### Coordinate GLOBE (coordinate_globe)
- Griglia temporanea di **72 etichette** (`B1`…`G12`) distribuite sulla sfera come riferimento. Gli anelli polari A e H sono omessi.
- Elementi DOM `.coord-globe` (`z-index: 9005`), creati dinamicamente in `setup()` e appesi al `body`.
- Proiezione manuale come MEME, nascoste quando il punto è dietro la sfera (`lz2 >= f`).

---

## Convenzioni tecniche
- **Pagine autonome**: CSS e JS inline in ciascun HTML (`index.html`, `globe.html`, `dr_strange.html`).
- **p5.js WEBGL**: caricato da CDN (`1.9.4`) **solo** su `globe.html`. Il secondo `<script>` di `globe.html` contiene la sfera.
- **JS scope** su `globe.html`: il primo script gestisce UI/interattività/linea, il secondo gestisce p5 (globo).
- **Transizioni CSS**: usare `cubic-bezier(0.45, 0, 0.55, 1)` o `cubic-bezier(0.55, 0, 0.25, 1)` per movimenti gentle/morbidi.
- **No git push**: **NON fare push su GitHub** finché l'utente non lo chiede esplicitamente.
- **No `screenX/Y/Z` in p5 WEBGL**: usare sempre la proiezione manuale (vedi codice esistente nel draw).

---

## Flussi principali
| Azione | Effetto |
|--------|---------|
| Click su **BLOCK** (hero) | Vai a `globe.html` |
| Click **Return** o tasto **Esc** (su GLOBE) | Vai a `index.html` |
| Mouse su elemento interattivo | Crosshair ruota 180°, linea curva si aggancia, hitbox appare |
| Mouse fuori da elementi | Linea si retrae verso il cursore, hitbox scompare |
| Hover su MEME | Macchia bianca sale riempiendo il bottone, testo inverte |
