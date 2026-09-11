# AGENTS.md — BLOCK. Studio

## Preferenze comunicazione
- Sono italiano. **Rispondi sempre in italiano**, anche se il codice o i commenti tecnici sono in inglese.
- **Prima di scrivere codice**, verifica se hai compreso le mie intenzioni. Se hai dubbi, fermati e **fammi domande**. Se è tutto chiaro, procedi direttamente alla scrittura del codice.
- **Non sono un programmatore**: tu prendi le decisioni **tecniche** (linguaggi, librerie, architettura, implementazione). **Lascia a me** le decisioni di **prodotto e comportamento** (cosa deve fare, come deve apparire, flussi utente, scelte stilistiche).

---

## Overview progetto
Sito per **BLOCK. Studio** (design studio di East London). Stile: **urbano, minimal, coordinate geografiche come elementi estetici**.

Stack: **Astro**. `Test_1/` è l’archivio HTML originale, non è il sito in produzione.

Pubblicato su GitHub Pages: https://brakoh.github.io/block-studio/

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
src/pages/globe.astro            — GLOBE (sfera p5, LOUDNESS, OVERSEERS, WASTE, Return)
src/pages/overseers.astro        — OVERSEERS (Feed CCTV, Blob)
src/pages/waste.astro            — WASTE (Basin, Rewind, Live)
src/pages/loudness.astro         — LOUDNESS (città punti/linee, traffico)
src/scripts/waste-scene.js       — scena canvas WASTE + MediaPipe Hands
src/scripts/overseers-scene.js   — scena canvas OVERSEERS (webcam, pixel, Blob, MediaPipe)
src/scripts/loudness-scene.js    — scena Three.js LOUDNESS
src/scripts/loudness-audio.js    — loop audio LOUDNESS (urban / traffic / siren)
src/scripts/loudness-mosh.js     — post-process datamosh LOUDNESS
src/styles/waste.css             — WASTE
src/styles/overseers.css         — OVERSEERS
src/styles/loudness.css          — LOUDNESS
assets/sounds/                   — mp3 urban, traffic, Siren
public/scripts/globe-sphere.js   — sfera p5 (script classico, globale)
docs/adr/                        — decisioni di architettura
Test_1/                          — HTML originale (archivio)
```

Route: `/` home · `/globe` GLOBE · `/overseers` OVERSEERS · `/waste` WASTE · `/loudness` LOUDNESS

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
- Su `/loudness` la linea di aggancio è spenta. Lo slider TRAFFIC ha il rettangolo hitbox sempre visibile.

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
- LOUDNESS e `.coord-globe` usano la proiezione manuale sulle posizioni di riposo. Nascosti quando `lz2 >= f`.
- **Proiezione manuale**: NON usare `screenX/screenY/screenZ` di p5. Rotazioni `rotateY(rotY)` + `rotateX(rotX + 0.12)`, fov 60°, `f = (height/2)/tan(PI/6)`.

### Pulsanti sulla sfera (`.globe-tag`)
- **LOUDNESS** (`#globe-tag-loudness`): ancorato a **D4**, link a `/loudness`.
- **OVERSEERS** (`#globe-tag-overseers`): ancorato a **E3**, link a `/overseers`.
- **WASTE** (`#globe-tag-waste`): ancorato a **E5**, link a `/waste`.
- Posizionati con proiezione manuale, `z-index: 9007` (sopra canvas e coordinate).
- **Hover**: fondo nero riempito da **macchia bianca che sale dal basso** (`translateY(100%) → 0`), con clip-path a singola onda che a fine corsa copre interamente il rettangolo. Testo inverte da bianco a nero.
- Se la sfera ruota e il punto finisce dietro, il tasto si nasconde (`display: none`).

### Coordinate GLOBE (coordinate_globe)
- Griglia temporanea di **72 etichette** (`B1`…`G12`) distribuite sulla sfera come riferimento. Gli anelli polari A e H sono omessi.
- Elementi DOM `.coord-globe` (`z-index: 9005`), creati dinamicamente in `setup()` e appesi al `body`.
- Proiezione manuale come LOUDNESS, nascoste quando il punto è dietro la sfera (`lz2 >= f`).

### Pagina LOUDNESS (`/loudness`)
- Pagina autonoma, aperta dal tasto **LOUDNESS** su GLOBE (`#globe-tag-loudness`) → `/loudness`.
- Return in alto a sinistra (stesso posto di GLOBE) e tasto **Escape** tornano a `/globe`.
- Scena Three.js `#loudness-scene`: città contemporanea da alto obliquo, solo punti e segmenti di linea (niente superfici piene, niente CAD pulito).
- Gerarchia visiva: nuvole di punti bianchi sui palazzi → geometria sottile di strade → particelle di traffico → griglia rossa a terra → fondo nero.
- Traffico: punti bianchi che seguono la rete stradale, due sensi, velocità diverse, scie lievi. La camera orbita molto lentamente.
- Slider **TRAFFIC** sotto Return, verticale, centrato rispetto al tasto, senza etichetta visibile. Parte da zero (in basso, rado). In alto più denso, in basso più rado. Al massimo le strade sono piene di rettangoli bianchi con scia. Hitbox sempre visibile intorno allo slider. Nessuna linea di aggancio dal cursore.
- Audio in loop, volume dallo slider. Ogni layer ha la sua curva: `urban.mp3` 0→100% tra slider 0 e 30%; `traffic.mp3` entra al 40% e arriva a 100% al 60%; `Siren.mp3` entra al 50% e arriva a 100% al massimo, con gain extra così taglia il letto urbano/traffico. Sopra a queste curve, il master (`MASTER_MIN` / `MASTER_VOLUME` in `loudness-audio.js`) scala tutti i layer insieme: 30% con lo slider in basso, 100% in alto. All’apertura urban è ancora a 0 sulla sua curva, quindi silenzio. Parte al primo gesto sulla pagina (click / slider); il browser blocca l’autoplay.
- Datamosh dal 50% dello slider: vibrazione e artefatti a blocchi, appena visibili all’inizio, molto forti al 100% (curva quadratica). Sotto il 50% l’immagine è pulita. Solo sul canvas della città, non sul chrome.
- Banda nera a sinistra (`.loudness-veil`) sotto Return e TRAFFIC, sfumata verso destra fino a sparire nella città.

### Pagina OVERSEERS (`/overseers`)
- Pagina autonoma, aperta dal tasto **OVERSEERS** su GLOBE (`#globe-tag-overseers`) → `/overseers`.
- Return in alto a sinistra (stesso posto di GLOBE) e tasto **Escape** tornano a `/globe`.
- Scena canvas `#overseers-scene`: prima il tracking sul video pulito (MediaPipe Pose, Face, Hands), poi il Feed CCTV a pieno schermo — scala di grigi, celle da 4px, scanline, stutter veloce da vertical sync. I Blob sono finestre visibili agganciate a molte parti della persona (testa, occhi, vestiti, accessori, dita): bordo 1px verde, ritaglio del Feed sfasato, codice estetico tipo `B4-2C`, linee rette 1px verdi che si riannodano in continuazione tra le finestre.
- Webcam specchiata, copre lo schermo. Se la camera manca: `CAMERA UNAVAILABLE`. Nessun riquadro Live, nessun altro overlay HUD oltre al chrome dello studio.

### Pagina WASTE (`/waste`)
- Pagina autonoma, aperta dal tasto **WASTE** su GLOBE (`#globe-tag-waste`) → `/waste`.
- Return in alto a sinistra (stesso posto di GLOBE) e tasto **Escape** tornano a `/globe`.
- **Live** (`#waste-live`): riquadro webcam sotto Return, 160×120, video a opacità 50%, specchiato. `pointer-events: none`. Se la camera manca: `CAMERA UNAVAILABLE`.
- Scena canvas `#waste-scene`: Basin inventato (vasca asciutta, Plinth vuoto), disegno piatto. Iscrizioni `SECTOR Q`, `BASIN 3`, `PLINTH: VACANT`, `ELEVATION — 0M — DRY`.
- **Rewind** 0→1 (sporco→pulito), parte da 0. Un giro pieno di tutta la mano: antiorario pulisce, orario sporca. Mano assente o camera negata: il Rewind congela.
- **Debris** (transenna, hoarding `COMING SOON`, pila di box, monopattino, telo): pochi grandi davanti, massa più piccola dietro. Caduta riavvolta. MediaPipe Hands in `waste-scene.js`.
- **Grade**: dal grigio studio verso terre (terracotta, ossido, verde sporco), anche su iscrizioni e chrome.

---

## Convenzioni tecniche
- **Astro**: CSS in `src/styles/`, UI condivisa in `src/scripts/studio-ui.js`, markup in `src/pages/`.
- **p5.js WEBGL**: caricato da CDN (`1.9.4`) **solo** su `/globe`. La sfera sta in `public/scripts/globe-sphere.js` (script classico, non modulo).
- **JS scope** su `/globe`: `studio-ui.js` gestisce UI/linea; `globe-sphere.js` gestisce p5. La sfera legge `window.cMouseX` / `window.cMouseY`.
- **WASTE**: `studio-ui.js` per chrome/linea; `waste-scene.js` per canvas + MediaPipe Hands (CDN Tasks Vision). Nessun audio.
- **OVERSEERS**: `studio-ui.js` per chrome/linea; `overseers-scene.js` per canvas 2D (webcam, pixel, Blob) + MediaPipe Pose/Face/Hands (CDN Tasks Vision). Nessun audio.
- **LOUDNESS**: `studio-ui.js` per chrome (niente linea di aggancio; hitbox fissa sullo slider); `loudness-scene.js` per Three.js (WebGL, Points, LineSegments); `loudness-audio.js` per i tre loop; `loudness-mosh.js` per il datamosh dal 50% dello slider. Slider TRAFFIC verticale sotto Return. Nessun altro overlay HUD oltre al chrome dello studio.
- **Transizioni CSS**: usare `cubic-bezier(0.45, 0, 0.55, 1)` o `cubic-bezier(0.55, 0, 0.25, 1)` per movimenti gentle/morbidi.
- **No git push**: **NON fare push su GitHub** finché l'utente non lo chiede esplicitamente.
- **No `screenX/Y/Z` in p5 WEBGL**: usare sempre la proiezione manuale (vedi codice esistente nel draw).

---

## Flussi principali
| Azione | Effetto |
|--------|---------|
| Scroll sulla home | I testi (sezioni, paragrafi, project, contact, footer) compaiono con fade e lieve salita. Nav e chrome restano fissi. |
| Click su **BLOCK** (hero) | Vai a `/globe` |
| Click **Return** o tasto **Esc** (su GLOBE) | Vai a `/` |
| Mouse su elemento interattivo | Crosshair ruota 180°, linea curva si aggancia, hitbox appare |
| Mouse fuori da elementi | Linea si retrae verso il cursore, hitbox scompare |
| Hover su LOUDNESS, OVERSEERS o WASTE | Macchia bianca sale riempiendo il bottone, testo inverte |
| Click su **LOUDNESS** (GLOBE) | Vai a `/loudness` |
| Click su **OVERSEERS** (GLOBE) | Vai a `/overseers` |
| Click su **WASTE** (GLOBE) | Vai a `/waste` |
| Click **Return** o tasto **Esc** (su LOUDNESS) | Vai a `/globe` |
| Click **Return** o tasto **Esc** (su OVERSEERS) | Vai a `/globe` |
| Slider TRAFFIC su LOUDNESS | Più in alto, più veicoli e più strati di suono (fondo, traffico, sirene). Dal 50% in su, datamosh via via più forte |
| Click **Return** o tasto **Esc** (su WASTE) | Vai a `/globe` |
| Mano antiorario su WASTE | Rewind verso il pulito; Debris escono; Grade si scalda |
| Mano orario su WASTE | Debris ricadono; Grade torna grigio |
