# GLOBE page split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spostare GLOBE in `globe.html` e togliere overlay, p5 e sfera da `index.html`, conservando lo stesso look e i flussi BLOCK / Return / Esc.

**Architecture:** `globe.html` è una pagina autonoma (CSS/JS inline + p5). La home naviga a `globe.html` al click su BLOCK. Return e Esc usano `index.html`. Nessun overlay, nessun `globeOpen`. Linea su GLOBE solo in hover.

**Tech Stack:** HTML/CSS/JS inline, p5.js 1.9.4 WEBGL solo su `globe.html`.

## Global Constraints

- Creare `globe.html`. Modificare `index.html` e `AGENTS.md`. Non toccare `dr_strange.html`.
- Path relativi: BLOCK → `globe.html`, Return/Esc → `index.html`.
- Non introdurre pulse / sfera viva. Copiare FACE_PARAMS e lo script sfera attuali (`lineCount: 140`, `sway: 0.18`, `follow: 0.04`).
- Proiezione manuale; niente `screenX` / `screenY` / `screenZ`.
- Su `globe.html`: sempre `loop()`, niente `#globe-screen`, `#face-canvas` visibile, etichette appendate al `body`.
- Linea GLOBE: `targetCurrent = hoverA` (solo hover). Home: magnete `best && bestD < MAX_RANGE`.
- Verifica a occhio nel browser. Non push. Commit solo se richiesto.

## File map

- Create: `globe.html`
- Modify: `index.html` (togliere p5, overlay, script sfera; BLOCK naviga)
- Modify: `AGENTS.md` (file structure, GLOBE come pagina, flussi)
- Do not modify: `dr_strange.html`

---

### Task 1: Creare `globe.html`

**Files:**
- Create: `globe.html`

**Interfaces:**
- Consumes: CSS/JS GLOBE e sfera da `index.html` attuale.
- Produces: pagina GLOBE autonoma; Return/Esc → `index.html`.

- [x] **Step 1:** Creare `globe.html` con telaio, Return, MEME, croce, linea (hover-only), p5 sempre in loop.
- [x] **Step 2:** Verificare nel browser: sfera, etichette, MEME, Return, croce.

### Task 2: Alleggerire `index.html`

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `.hero h1` come bersaglio click.
- Produces: home senza p5; click BLOCK → `globe.html`.

- [x] **Step 1:** Rimuovere p5, CSS/HTML overlay, script sfera, `openGlobe`/`closeGlobe`. BLOCK → `globe.html`. `collectInteractive` / `anchorDraw` senza rami overlay.
- [x] **Step 2:** Verificare home senza GLOBE; BLOCK apre `globe.html`; Return/Esc tornano; `dr_strange` invariato.
- [x] **Step 3:** Aggiornare `AGENTS.md`.
