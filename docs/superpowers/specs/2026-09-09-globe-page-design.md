# GLOBE come pagina `globe.html`

Data: 2026-09-09
Stato: approvato in brainstorming, in attesa di review sulla spec scritta

## Problema

GLOBE vive come overlay dentro `index.html`, insieme a p5.js e allo script della sfera. La home resta pesante anche quando la sfera è chiusa. Serve la stessa esperienza GLOBE, in un file a parte, per alleggerire il progetto.

## Obiettivo

Un file nuovo `globe.html` con la scheda GLOBE (sfera, MEME, etichette, Return, telaio, croce, linea). `index.html` perde overlay, p5 e codice sfera. Click su **BLOCK** apre `globe.html`. Return e Esc tornano a `index.html`.

Criterio di successo: la home si carica senza p5 e senza overlay; BLOCK porta a una pagina che si vede e si usa come GLOBE oggi; Return/Esc riportano alla home; `dr_strange.html` resta com’è.

## Fuori scope

- Cambiare look o comportamento visivo di sfera, MEME, etichette, croce, linea (si sposta, non si redesigna)
- Sfera “viva” / pulse (`docs/superpowers/specs/2026-09-09-globe-living-sphere-design.md`) — non è nel codice attuale; non va introdotta in questo giro
- `dr_strange.html`
- Estrarre CSS/JS condivisi in file esterni
- `BustBaseMesh_Decimated.obj`
- Uso di `screenX` / `screenY` / `screenZ` di p5 WEBGL
- Push su GitHub

## Flusso

| Azione | Effetto |
|--------|---------|
| Click su **BLOCK** (hero, `.hero h1`) | Vai a `globe.html` |
| Click **Return** | Vai a `index.html` |
| Tasto **Esc** (su `globe.html`) | Vai a `index.html` |
| Refresh su `globe.html` | Resta su GLOBE; sfera riparte da rotazione zero |

Arrivo: da BLOCK e anche da URL diretto (`globe.html`), perché è una pagina vera del sito, non un file di lavoro nascosto come `dr_strange`.

Ritorno alla home: `index.html` già forza lo scroll in cima al load — si atterra in alto, come al refresh.

## Cosa si vede

### Home (`index.html`)

Identica, senza scheda GLOBE. Nav, hero BLOCK, About / Work / Contact, croce, linea elastica (magnete nel raggio, come oggi a GLOBE chiuso). Niente overlay, niente sfera, niente MEME.

### GLOBE (`globe.html`)

Stessa scena dell’overlay attuale, a schermo pieno:

- Fondo `--bg`, watermark, 4 angoli, striscia laterale
- Sfera di punti p5 WEBGL, follow cursore `sway: 0.18` / `follow: 0.04`
- Linee curve (~140), vita e coda, estremi `a.x/y/z`
- Etichette `B1`…`G12` (anelli A e H omessi), MEME su D4
- Proiezione manuale (stesse rotazioni `rotateY(rotY)` + `rotateX(rotX + 0.12)`, fov 60°, `f = (height/2)/tan(PI/6)`). Nascosti se `lz2 >= f`
- Return in alto a sinistra
- Croce + coordinate mouse; linea elastica **solo in hover** su Return o MEME (niente magnete verso la sfera — stesso ramo “GLOBE aperto” di oggi)
- Cursore di sistema nascosto

Non c’è nav About/Work/Contact, non c’è hero BLOCK. Non c’è stato aperto/chiuso: la pagina *è* GLOBE.

## Architettura

```
index.html        — home, senza p5 / overlay / sfera
globe.html        — pagina GLOBE autonoma (nuovo)
dr_strange.html   — invariato
```

Ogni file resta self-contained (CSS e JS inline). Niente fogli condivisi in questo giro.

### `globe.html`

Copia da `index.html` lo stato attuale di GLOBE (non la spec “sfera viva”):

- CSS: reset, palette, `cursor: none`, watermark, corner-coord, side-strip, crosshair, `#anchor-line`, `.globe-return`, `.globe-tag` (hover macchia), `.coord-globe`, `#face-canvas` visibile (non `display: none`)
- HTML: telaio, croce, canvas linea, Return, MEME. Niente `#globe-screen` overlay, niente `.open`
- JS UI: croce, coordinate, canvas linea, `interactiveSel` invariato, `collectInteractive` senza filtro overlay (tutti i bersagli visibili della pagina: Return e MEME). In `anchorDraw`: `globeOpen = true` fisso → `targetCurrent = hoverA`
- JS p5: stesso secondo script, p5 1.9.4 da CDN. `setup` crea il canvas, `buildFace`, `buildLabels`, `resetLines`, `pickTagAnchor`. Le etichette si appendono al `body` (o a un wrapper pagina), non a `#globe-screen`. **Sempre `loop()`** — niente `noLoop()`, niente early-return su `globeOpen`
- Return: `location` verso `index.html`. Esc: stesso. Path relativo `index.html` (GitHub Pages)

`window.resetGlobe` non serve più da un altro script: il load della pagina azzera già rotazione e linee. Si può tenere come init interno di `setup`, senza ponte verso la home.

### `index.html` — cosa togliere

- `<script src="…p5.min.js">` e l’intero secondo `<script>` della sfera
- `#globe-screen` e il suo contenuto
- CSS GLOBE: `.globe-screen`, `.globe-return`, `.globe-tag`, `.coord-globe`, `#face-canvas`
- `openGlobe` / `closeGlobe`, listener Return/Esc GLOBE, `globeScreen` / `globeReturn`
- Rami `globeOpen` in `collectInteractive` e `anchorDraw`: GLOBE non c’è più; resta solo il magnete nel raggio (`best && bestD < MAX_RANGE`)

### `index.html` — BLOCK

I due listener che oggi chiamano `openGlobe()` navigano a `globe.html` (path relativo). Stesso bersaglio visivo (`.hero h1`); niente overlay.

### Dipendenze

- p5.js 1.9.4 WEBGL: **solo** su `globe.html`
- Font Google Inter + Space Mono: home e GLOBE, come ora

## Casi limite

- `globe.html` aperto da URL: scena GLOBE completa; Esc/Return → home
- MEME dietro la sfera: `display: none`, come ora
- Resize: `windowResized` ridimensiona il canvas; `collectInteractive` ricalcola Return/MEME
- Home senza p5: click BLOCK non deve chiamare `resetGlobe` / `loop` / `noLoop`
- `file://` e server locale: path relativi `index.html` / `globe.html`

## Verifica

1. `index.html`: niente overlay, niente sfera, niente script p5. Croce e linea sulla home come a GLOBE chiuso.
2. Click BLOCK → `globe.html`; sfera visibile, etichette, MEME, Return, croce.
3. Linea su GLOBE solo in hover su Return o MEME; croce ruota lì.
4. Return → `index.html`. Esc su GLOBE → `index.html`. Esc sulla home non naviga.
5. Hover MEME: macchia bianca + testo invertito.
6. `dr_strange.html` invariato; nessun link nuovo verso `dr_strange`.

Niente test automatici: verifica a occhio nel browser. Confrontare peso: `index.html` non deve più contenere p5 né lo script sfera.
