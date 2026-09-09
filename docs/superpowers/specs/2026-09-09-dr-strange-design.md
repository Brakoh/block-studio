# dr_strange — pagina telaio

Data: 2026-09-09
Stato: approvato in brainstorming, in attesa di review sulla spec scritta

## Problema

Serve una seconda pagina HTML, isolata da BLOCK, su cui lavorare in seguito. Oggi deve essere solo il telaio grafico dello studio: stesso look, nessun contenuto, nessun modo di arrivarci dal sito.

## Obiettivo

Un file nuovo `dr_strange.html` accanto a `index.html`. Stessa pelle visiva (palette, font, watermark, angoli, striscia, logo, orario, croce). Pagina vuota al centro. Nessun elemento cliccabile. Gli script della linea elastica e della rotazione della croce restano, identici nella logica: senza bersagli non si attivano.

Criterio di successo: aprendo `dr_strange.html` a mano si vede il telaio di BLOCK su fondo nero, senza sezioni né GLOBE; la croce segue il mouse; l’orario gira; da `index.html` non esiste nessun link verso questa pagina.

## Fuori scope

- Qualsiasi modifica a `index.html` (nessun link, nessun redirect)
- GLOBE, sfera p5, pulsante MEME, etichette `coordinate_globe`, Return, Esc
- Hero BLOCK, sezioni About / Work / Contact, footer, link di nav
- Estrarre CSS/JS condivisi in file esterni
- Pubblicazione, menu, routing, GitHub Pages per questa pagina
- Contenuto futuro della pagina (si aggiunge dopo, solo su questo file)

## Cosa si vede

Stesso involucro della home, senza i pezzi interattivi o di contenuto:

- Sfondo `--bg`, testo `--fg`, font Inter + Space Mono
- Watermark centrale `51°30'26.4"N 0°07'39.6"W`
- Coordinate ai quattro angoli (stessi testi della home)
- Striscia laterale `51.5074° N — 0.1278° W — LONDON — GB`
- Barra in alto: logo `BLOCK.` a sinistra, orario UTC a destra. Niente About / Work / Contact
- Croce custom che segue il mouse, coordinate lat/lng sotto
- Cursore di sistema nascosto (`cursor: none`)
- Centro pagina vuoto: niente titolo, niente testo, niente sfera

Su viewport stretta (≤768px) angoli e striscia si nascondono, come sulla home.

## Comportamento

- **Arrivo:** solo apertura manuale del file (doppio click, “Open with Live Server”, URL digitato a mano). Nessun link, nessun bottone, nessun `href` verso `dr_strange.html` in nessun altro file.
- **Croce:** segue il mouse come sulla home. Coordinate in basso calcolate allo stesso modo.
- **Orario:** `#nav-time` aggiornato ogni secondo in UTC, come sulla home.
- **Linea elastica + rotazione:** stesso selettore `interactiveSel` e stesso disegno canvas. Oggi `collectInteractive()` trova zero elementi, quindi la linea resta ritratta verso il cursore e la croce non prende `.active`. Quando in seguito si aggiungeranno link o bottoni su questa pagina, linea e rotazione partiranno da soli.
- **GLOBE:** assente. Niente overlay, niente p5. Il codice non deve dipendere da `#globe-screen`, `.hero h1` o `#globe-return` (sulla home quei nodi ci sono; qui no — senza di essi uno script copiato alla lettera andrebbe in errore).
- **Scroll:** pagina senza contenuto da scrollare; niente hash, niente ripristino scroll verso sezioni.

## Architettura

Un solo file nuovo, autonomo, nello stesso stile single-file di `index.html` (CSS e JS inline).

```
dr_strange.html    — pagina telaio (nuovo)
index.html         — invariato
```

Titolo documento: lo stesso della home (`51°30'N — 0°07'W`), per restare nello stesso registro grafico.

### CSS da portare

Copiare da `index.html` solo le regole del telaio e del cursore:

- reset, `:root`, `html`/`body`, regola globale `cursor: none`
- `.watermark`, `.corner-coord`, `.side-strip`
- `nav`, `.logo`, `.nav-coord` (non servono `.nav-links` né hover dei link)
- `#crosshair`, `#crosshair-coord`, `#anchor-line`
- media query mobile che nasconde `.corner-coord` e `.side-strip`

Non copiare stili di hero, sezioni, progetti, contact, footer, GLOBE, MEME, canvas sfera.

### HTML

Stessi nodi decorativi della home (stessi testi), più croce e canvas linea. Nav senza `<ul class="nav-links">`. Niente `<section>`, niente `#globe-screen`, niente `#face-canvas`.

### JS

Un solo `<script>` (niente p5 da CDN).

Portare da `index.html`:

- posizionamento croce + testo coordinate su `mousemove`
- `updateTime` / `setInterval` su `#nav-time`
- canvas `#anchor-line`: resize, `collectInteractive`, `updateAnchorPositions`, `anchorDraw`, rotazione croce su hover

Non portare: `openGlobe` / `closeGlobe`, listener su `.hero h1`, `#globe-return`, Escape, `window.resetGlobe`, secondo script p5.

Dove lo script della home legge `globeScreen.classList.contains('open')`, su questa pagina GLOBE è sempre chiuso: niente elemento, niente ramo “globe aperto”. `interactiveSel` resta `'a, button, input, select, textarea, [role="link"], .hero h1'`.

### Dipendenze

- Font Google: stesso import Inter + Space Mono
- Nessun p5.js

## Casi limite

- File aperto da disco (`file://`) o da server locale: entrambi ok; nessun fetch, nessun CDN oltre i font
- Nessun elemento in `interactiveSel`: linea ritratta, croce a 0°, nessun crash
- Resize: canvas linea e lista ancore si ricalcolano come sulla home
- Mobile: telaio ridotto (niente angoli/striscia); croce e orario restano
- Aggiunta futura di un `button` o `a`: entra in `anchorList` al prossimo `collectInteractive` (resize) o al load se già nel markup

## Verifica

Aprire `dr_strange.html` a mano (non dal sito):

1. Telaio visibile: watermark, 4 angoli, striscia, `BLOCK.`, orario
2. Centro vuoto
3. Croce segue il mouse; coordinate in basso cambiano
4. Nessuna linea elastica visibile (niente da agganciare); croce non ruota
5. Nessun GLOBE, nessuna sfera, nessun link
6. Da `index.html`: BLOCK / nav / Contact invariati; nessun percorso verso `dr_strange`

Niente test automatici: verifica a occhio nel browser.
