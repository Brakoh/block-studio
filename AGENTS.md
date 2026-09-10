# AGENTS.md — BLOCK. Studio

## Preferenze comunicazione
- Sono italiano. **Rispondi sempre in italiano**, anche se il codice o i commenti tecnici sono in inglese.
- **Prima di scrivere codice**, verifica se hai compreso le mie intenzioni. Se hai dubbi, fermati e **fammi domande**. Se è tutto chiaro, procedi direttamente alla scrittura del codice.
- **Non sono un programmatore**: tu prendi le decisioni **tecniche** (linguaggi, librerie, architettura, implementazione). **Lascia a me** le decisioni di **prodotto e comportamento** (cosa deve fare, come deve apparire, flussi utente, scelte stilistiche).

---

## Overview progetto
Sito per **BLOCK. Studio** (design studio di East London). Stile: **urbano, minimal, coordinate geografiche come elementi estetici**.

Stack: **Astro**. `Test_1/` è l’archivio HTML originale, non è il sito in produzione.

Quando avvii il server di sviluppo, usa la modalità background:

```
astro dev --background
```

Gestiscilo con `astro dev stop`, `astro dev status` e `astro dev logs`.

---

## File structure
```
src/pages/copy.yml               — Copy del sito (paragrafi, etichette, iscrizioni, Identity)
src/content/projects_edit/       — Project (un Markdown ciascuno; ordine dal prefisso 01-, 02-)
src/content.config.ts            — schema collection Project
src/lib/copy.ts                  — legge copy.yml
src/layouts/StudioLayout.astro   — chrome condiviso (watermark, coordinate, crosshair, linea)
src/styles/global.css            — palette, cursore, nav, chrome
src/styles/home.css              — home
src/styles/globe.css             — pagina GLOBE
src/scripts/studio-ui.js         — crosshair, linea, orologio UTC, reset scroll home
src/pages/index.astro            — home
src/pages/globe.astro            — GLOBE (sfera p5, MEME, DR_STRANGE, DEPTH, Return)
src/pages/dr-strange.astro       — telaio grafico isolato, non linkato dalla home
public/scripts/globe-sphere.js   — sfera p5 (script classico, globale)
docs/adr/                        — decisioni di architettura
Test_1/                          — HTML originale (archivio)
```

Route: `/` home · `/globe` GLOBE · `/dr-strange` DR_STRANGE

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
- Su `/globe` la linea usa lo stesso magnete della home: si aggancia al tasto visibile più vicino (Return e tasti sulla sfera). I tasti nascosti dietro la sfera non sono bersagli.

---

## Pagina GLOBE (`/globe`)
- Pagina autonoma, aperta cliccando sul titolo **BLOCK** in hero (`.hero h1`) → `/globe`.
- Pulsante Return in alto a sinistra (`#globe-return`) e tasto **Escape** tornano a `/`.
- Al caricamento della home `history.scrollRestoration = 'manual'` e `window.scrollTo(0, 0)` per partire sempre dall'alto al refresh.

### Sfera 3D (p5.js WEBGL)
- Canvas `#face-canvas` (`z-index: 9001`, `pointer-events: none`), visibile per tutta la pagina.
- Sfera procedurale di punti. I punti **non si spostano**: niente pulse, respiro, rumore radiale, `displacedPos`, `applyPulse`, `pulseT`.
- Linee **scie** (~72) tra punti: partono da un punto e arrivano a un altro su una curva che si alza leggermente dalla sfera (tipo scia d’aereo). Testa più luminosa, coda che si dissolve. Si rinnovano in loop, non si fermano. Punti fermi: niente pulse, `displacedPos`, `applyPulse`, `pulseT`, `breathPhase`.
- La sfera **segue leggermente il cursore**: `sway: 0.18`, `follow: 0.04`.
- Al caricamento di `/globe` il crosshair parte dal **centro esatto** dello schermo. La sfera parte dall’orientamento in cui **D3, D4, E3, E4** sono equidistanti da quel centro (`homeRotY` / `homeRotX` dal baricentro dei quattro punti). Il follow resta intorno a quell’orientamento, non a `rotX = 0`. Linee generate in `setup()`.
- MEME e `.coord-globe` usano la proiezione manuale sulle posizioni di riposo. Nascosti quando `lz2 >= f`.
- **Proiezione manuale**: NON usare `screenX/screenY/screenZ` di p5. Rotazioni `rotateY(rotY)` + `rotateX(rotX + 0.12)`, fov 60°, `f = (height/2)/tan(PI/6)`.

### Pulsanti sulla sfera (`.globe-tag`)
- **MEME** (`#globe-tag`): ancorato a **D4**.
- **DR_STRANGE** (`#globe-tag-strange`): ancorato a **E3**, link a `/dr-strange`.
- **DEPTH** (`#globe-tag-depth`): ancorato a **E5**. Nessun link.
- Posizionati con proiezione manuale, `z-index: 9007` (sopra canvas e coordinate).
- **Hover**: fondo nero riempito da **macchia bianca che sale dal basso** (`translateY(100%) → 0`), con clip-path a singola onda che a fine corsa copre interamente il rettangolo. Testo inverte da bianco a nero.
- Se la sfera ruota e il punto finisce dietro, il tasto si nasconde (`display: none`).

### Coordinate GLOBE (coordinate_globe)
- Griglia temporanea di **72 etichette** (`B1`…`G12`) distribuite sulla sfera come riferimento. Gli anelli polari A e H sono omessi.
- Elementi DOM `.coord-globe` (`z-index: 9005`), creati dinamicamente in `setup()` e appesi al `body`.
- Proiezione manuale come MEME, nascoste quando il punto è dietro la sfera (`lz2 >= f`).

---

## Convenzioni tecniche
- **Astro**: CSS in `src/styles/`, UI condivisa in `src/scripts/studio-ui.js`, markup in `src/pages/`.
- **p5.js WEBGL**: caricato da CDN (`1.9.4`) **solo** su `/globe`. La sfera sta in `public/scripts/globe-sphere.js` (script classico, non modulo).
- **JS scope** su `/globe`: `studio-ui.js` gestisce UI/linea; `globe-sphere.js` gestisce p5. La sfera legge `window.cMouseX` / `window.cMouseY`.
- **Transizioni CSS**: usare `cubic-bezier(0.45, 0, 0.55, 1)` o `cubic-bezier(0.55, 0, 0.25, 1)` per movimenti gentle/morbidi.
- **No git push**: **NON fare push su GitHub** finché l'utente non lo chiede esplicitamente.
- **No `screenX/Y/Z` in p5 WEBGL**: usare sempre la proiezione manuale (vedi codice esistente nel draw).

---

## Flussi principali
| Azione | Effetto |
|--------|---------|
| Click su **BLOCK** (hero) | Vai a `/globe` |
| Click **Return** o tasto **Esc** (su GLOBE) | Vai a `/` |
| Mouse su elemento interattivo | Crosshair ruota 180°, linea curva si aggancia, hitbox appare |
| Mouse fuori da elementi | Linea si retrae verso il cursore, hitbox scompare |
| Hover su MEME, DR_STRANGE o DEPTH | Macchia bianca sale riempiendo il bottone, testo inverte |
| Click su **DR_STRANGE** (GLOBE) | Vai a `/dr-strange` |
