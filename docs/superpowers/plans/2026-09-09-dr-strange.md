# dr_strange telaio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creare `dr_strange.html`, pagina isolata con solo il telaio grafico di BLOCK (watermark, angoli, striscia, logo, orario, croce) e gli script di linea/rotazione, senza GLOBE né link da `index.html`.

**Architecture:** Un HTML autonomo, CSS/JS inline copiati dal telaio di `index.html`. GLOBE è sempre chiuso (nessun `#globe-screen`): `collectInteractive` prende solo i nodi `interactiveSel` visibili; `anchorDraw` usa il ramo non-GLOBE. Oggi la lista ancore è vuota.

**Tech Stack:** HTML/CSS/JS inline, font Google Inter + Space Mono, nessun p5.js.

## Global Constraints

- Creare solo `dr_strange.html` nella root del repo. Non modificare `index.html`.
- Nessun `href` verso `dr_strange.html` in nessun file.
- Titolo documento: `51°30'N — 0°07'W`.
- Palette: `--bg: #0a0a0a`, `--fg: #e8e8e8`, `--muted: #4c4c4c`, `--accent: #c4c4c4`, `--dim: #282828`.
- Cursore di sistema nascosto; croce 24×24, `mix-blend-mode: difference`.
- `interactiveSel = 'a, button, input, select, textarea, [role="link"], .hero h1'`.
- Nessun p5.js, nessun `#globe-screen`, nessun `.hero`, nessun link di nav.
- Verifica a occhio nel browser (la spec vieta test automatici).
- Non push su GitHub. Non committere se non richiesto.

## File map

- Create: `dr_strange.html` — pagina telaio completa.
- Do not modify: `index.html`.
- Do not create: CSS/JS esterni, p5, routing.

---

### Task 1: Pagina telaio `dr_strange.html`

**Files:**
- Create: `dr_strange.html`

**Interfaces:**
- Consumes: CSS/JS del telaio da `index.html` (watermark, corner-coord, side-strip, nav, crosshair, `#anchor-line`).
- Produces: pagina autonoma apribile a mano; `collectInteractive()`, `anchorDraw()`, `updateTime()`.

- [x] **Step 1: Creare `dr_strange.html` con telaio, croce, orario e script linea/rotazione (GLOBE sempre chiuso)**

HTML: watermark, 4 `.corner-coord`, `.side-strip`, `#crosshair`, `#anchor-line`, `#crosshair-coord`, `nav` con `.logo` + `#nav-time` (niente `.nav-links`).

JS: niente `globeScreen`. In `anchorDraw`, `const globeOpen = false` e `targetCurrent = best && bestD < MAX_RANGE ? best : null`. `collectInteractive` filtra solo elementi `interactiveSel` con bounding box > 0.

- [x] **Step 2: Verificare nel browser**

Aprire `dr_strange.html`. Controllare telaio, centro vuoto, croce che segue, orario, nessuna linea elastica, nessun GLOBE. Grep su `index.html`: nessun `dr_strange`.

- [ ] **Step 3: Commit solo se richiesto dall’utente**
