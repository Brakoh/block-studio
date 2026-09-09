# GLOBE living sphere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far pulsare in radiale la nube di punti GLOBE (bolle lente al 4% del raggio) e ancorare linee curve, MEME e etichette A1–H12 allo stesso campo, senza cambiare il follow del cursore.

**Architecture:** Una funzione `displacedPos(x, y, z)` campiona `noise()` di p5 sulla posizione di riposo + `pulseT`. `applyPulse()` avanza il tempo una volta per frame e scrive `px, py, pz` su ogni elemento di `facePts`. Linee, punti, MEME e etichette leggono quelle posizioni (o richiamano la stessa funzione con lo stesso `pulseT`). `window.resetGlobe` non azzera `pulseT`.

**Tech Stack:** `index.html` single-file, p5.js 1.9.4 WEBGL da CDN, CSS/JS inline.

## Global Constraints

- Single-file: modificare solo lo script p5 in `index.html` (e, nel task docs, `AGENTS.md`). Non creare moduli, test runner o file JS nuovi.
- p5.js 1.9.4 WEBGL già da CDN; non usare `screenX` / `screenY` / `screenZ`.
- Parametri esatti: `pulseAmp: 0.04`, `pulseScale: 2.0`, `pulseSpeed: 0.004`.
- Formula esatta: `n = noise(x * pulseScale, y * pulseScale, z * pulseScale + pulseT) * 2 - 1`, posizione = riposo × `(1 + pulseAmp * n)`.
- Linee restano curve con il renderer già nel working copy (`lineCount: 650`, bulge quadratico, coda che viaggia). Non ripristinare il loop a tratti dritti del commit `ce6c034`.
- `sway: 0.18` e `follow: 0.04` non si toccano. Ordine in `draw`: rotazione cursore → `applyPulse()` → `rotateY`/`rotateX` → disegno mesh → proiezione DOM.
- `window.resetGlobe` azzera solo `rotY`/`rotX`, rigenera le linee e richiama `pickTagAnchor`. Non toccare `pulseT`.
- Verifica a occhio nel browser (la spec vieta un harness di test). Aprire `file:///Users/veethoryo/Desktop/Workshop/Test_1/index.html` oppure un server statico sulla cartella del repo.
- Non push su GitHub. Non toccare hero, nav, crosshair, linea elastica, overlay, Return, Esc, palette, font, né `BustBaseMesh_Decimated.obj`.

## File map

- Modify: `index.html` — secondo `<script>` (sfera p5), circa righe 1064–1347. Unico posto in cui vive il campo di spostamento.
- Modify: `AGENTS.md` — documentare pulse e ancoraggio pelle (task finale).
- Do not create: nuovi `.js`, cartelle `src/`, test automatici.

---

### Task 1: Campo di spostamento + punti e linee sulla pelle

**Files:**
- Modify: `index.html` (oggetto `FACE_PARAMS` ~1067–1087; dopo `let rotY = 0, rotX = 0` ~1117; funzione `draw` ~1221–1290)

**Interfaces:**
- Consumes: `facePts[].x/y/z` (riposo), `lines[].a` / `lines[].b` (riferimenti agli stessi oggetti), `noise()` di p5, `FP.lineCount` e il renderer curve già presente.
- Produces: `FP.pulseAmp`, `FP.pulseScale`, `FP.pulseSpeed`; `let pulseT`; `displacedPos(x, y, z) => { x, y, z }`; `applyPulse()` che incrementa `pulseT` e scrive `p.px`, `p.py`, `p.pz` su ogni punto; linee e punti disegnati da `px/py/pz`.

- [ ] **Step 1: Baseline visiva (nessun pulse)**

Aprire GLOBE (click su BLOCK). Confermare: la nube è una sfera ferma (solo rotazione verso il cursore); le linee sono curve e nascono/muoiono; MEME e A1–H12 stanno su una sfera ideale. I punti non si allontanano/avvicinano al centro a zone.

- [ ] **Step 2: Aggiungere i tre parametri in `FACE_PARAMS`**

Subito dopo `lineLife: 22,` inserire:

```javascript
            lineLife: 22,          // durata media di una linea (frame)
            pulseAmp: 0.04,        // ampiezza radiale (frazione del raggio)
            pulseScale: 2.0,       // scala spaziale del rumore (bolle larghe)
            pulseSpeed: 0.004,     // avanzamento tempo rumore per frame
```

Non modificare `lineCount`, `sway`, `follow`.

- [ ] **Step 3: Aggiungere `pulseT`, `displacedPos`, `applyPulse`**

Subito dopo `let rotY = 0, rotX = 0;` inserire:

```javascript
        let rotY = 0, rotX = 0;
        let pulseT = 0;

        function displacedPos(x, y, z) {
            const sc = FP.pulseScale;
            const n = noise(x * sc, y * sc, z * sc + pulseT) * 2 - 1;
            const f = 1 + FP.pulseAmp * n;
            return { x: x * f, y: y * f, z: z * f };
        }

        function applyPulse() {
            pulseT += FP.pulseSpeed;
            for (const p of facePts) {
                const d = displacedPos(p.x, p.y, p.z);
                p.px = d.x;
                p.py = d.y;
                p.pz = d.z;
            }
        }
```

Vincoli: `x, y, z` di `facePts` restano il riposo (non sovrascriverli). `displacedPos` non incrementa `pulseT`. Solo `applyPulse` lo fa, una volta per frame.

- [ ] **Step 4: Chiamare `applyPulse` e disegnare mesh sulle posizioni spostate**

In `draw`, dopo il blocco `rotY`/`rotX` e il calcolo di `s`, prima di `push()`:

```javascript
            rotY += (targetRotY - rotY) * FP.follow;
            rotX += (targetRotX - rotX) * FP.follow;

            const s = Math.min(width, height) * FP.sizeFactor * 2;
            applyPulse();
            push();
            rotateY(rotY);
            rotateX(rotX + 0.12);
```

Nel loop linee, sostituire solo le sei letture degli estremi (lasciare bulge, `steps`, coda, `stroke` invariati):

```javascript
                const ax = l.a.px * s, ay = l.a.py * s, az = l.a.pz * s;
                const bx = l.b.px * s, by = l.b.py * s, bz = l.b.pz * s;
```

Nel loop punti, sostituire:

```javascript
            strokeWeight(FP.pointR * 2);
            stroke(235, 235, 235, FP.faceAlpha * 255);
            for (const p of facePts) {
                point(p.px * s, p.py * s, p.pz * s);
            }
```

Non cambiare `spawnLine`, `resetLines`, `window.resetGlobe`.

- [ ] **Step 5: Verificare punti e linee**

Ricaricare la pagina, click su BLOCK.

Atteso:
- La forma resta una sfera.
- Zone diverse si alzano e si abbassano lente (qualche secondo), non un gonfiore unico e non un brulichio punto-per-punto.
- Le linee restano curve, con coda/respiro, e si stirano con i punti.
- Il follow del cursore è lo stesso di prima.
- MEME e A1–H12 in questo task possono ancora stare sulla sfera ideale (task 2).

Se i punti pulano ma le linee restano “incollate” al riposo, `applyPulse` manca prima del loop linee oppure gli estremi leggono ancora `.x` invece di `.px`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: pulse GLOBE points and curved lines on a shared radial field

EOF
)"
```

---

### Task 2: MEME e etichette A1–H12 sulla stessa pelle

**Files:**
- Modify: `index.html` (`draw`, blocco `tagAnchor` ~1293–1342)

**Interfaces:**
- Consumes: `displacedPos(x, y, z) => { x, y, z }` e `pulseT` già avanzato da `applyPulse()` nello stesso `draw`; `tagAnchor.x/y/z` e `labelEls[].p.x/y/z` restano riposo; proiezione manuale esistente (`rotY`, `rotX + 0.12`, `f = (height/2)/tan(PI/6)`).
- Produces: `left`/`top`/`display` di `#globe-tag` e `.coord-globe` calcolati sulla posizione spostata; hide se `lz2 >= f` o GLOBE chiuso, usando lo `z` spostato.

- [ ] **Step 1: Baseline**

GLOBE aperto dopo il Task 1: i punti pulano, MEME e le etichette non seguono le bolle.

- [ ] **Step 2: Proiettare MEME dalla posizione spostata**

Sostituire l’inizio del blocco tag, da `let px = tagAnchor.x * s` fino a prima di `const aY = rotY`, con:

```javascript
            const tagD = displacedPos(tagAnchor.x, tagAnchor.y, tagAnchor.z);
            let px = tagD.x * s, py = tagD.y * s, pz = tagD.z * s;

            const aY = rotY;
```

Il resto della proiezione (`px1`/`pz1`/`py2`/`pz2`/`f`/`display`/`left`/`top`) resta identico. Non introdurre `screenX`/`screenY`/`screenZ`. Non modificare `pickTagAnchor` (il riposo di D4 resta quello).

- [ ] **Step 3: Proiettare ogni etichetta dalla posizione spostata**

Nel loop `labelEls`, sostituire le tre righe che leggono `L.p.x/y/z * s` con:

```javascript
            for (let i = 0; i < labelEls.length; i++) {
                const L = labelEls[i];
                const labD = displacedPos(L.p.x, L.p.y, L.p.z);
                const lx = labD.x * s;
                const ly = labD.y * s;
                const lz = labD.z * s;
```

Il resto del loop (rotazioni, `if (!globeOpen || lz2 >= f)`, `left`/`top`) resta identico. La riga `if (!globeOpen) tagEl.style.display = 'none';` resta dopo il loop.

- [ ] **Step 4: Verificare ancoraggio DOM**

Ricaricare, aprire GLOBE, tenere il cursore fermo al centro per isolare il pulse dalla rotazione.

Atteso:
- MEME (D4) si alza/abbassa con la zona sotto di sé, insieme all’etichetta D4.
- Le altre etichette visibili si muovono con le bolle, non restano su una sfera liscia.
- Ruotando la sfera, quando un’etichetta o MEME va dietro (`lz2 >= f` / `pz2 >= f`) sparisce; tornando davanti riappare.
- Chiudere con Return o Esc: MEME e etichette nascosti. Riaprire: rotazione a zero, linee rigenerate, il respiro dei punti è ancora in corso (non riparte da un “gonfiore zero”).

Se MEME e D4 si muovono in disaccordo, uno dei due non passa da `displacedPos` nello stesso frame (stesso `pulseT`).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: anchor GLOBE MEME and coord labels to the pulsed surface

EOF
)"
```

---

### Task 3: Docs e verifica spec completa

**Files:**
- Modify: `AGENTS.md` (sezione «Sfera 3D (p5.js WEBGL)» e sotto-sezioni MEME / Coordinate GLOBE)

**Interfaces:**
- Consumes: comportamento dei Task 1–2 già nel file.
- Produces: `AGENTS.md` allineato a pulse radiale, linee curve sulla pelle, MEME/etichette ancorati, reset che non azzera `pulseT`.

- [ ] **Step 1: Aggiornare `AGENTS.md`**

Nella sezione sfera, dopo i bullet su sway/follow e reset, aggiungere (o sostituire il bullet linee ~110 se ancora presente) testo equivalente a:

```markdown
- La sfera **pulsa in radiale**: `displacedPos` + `applyPulse` (`pulseAmp: 0.04`, `pulseScale: 2.0`, `pulseSpeed: 0.004`). I punti tengono il riposo in `x,y,z` e disegnano `px,py,pz`.
- Le **linee curve** (~650) usano `a.px` / `b.px` (stesso frame). Non raddrizzarle.
- MEME e `.coord-globe` passano da `displacedPos` **prima** della proiezione manuale. Hide con lo `z` spostato.
- `window.resetGlobe` non azzera `pulseT`.
```

Non riscrivere il resto di `AGENTS.md`. Non menzionare `screenX/Y/Z` come da usare.

- [ ] **Step 2: Checklist spec nel browser**

GLOBE aperto:

1. Forma = sfera; respiro a zone visibile ma contenuto (~4%).
2. Linee curve, seguono i punti.
3. MEME e A1–H12 si muovono con le bolle.
4. Follow cursore identico (`sway` 0.18, `follow` 0.04).
5. Dietro la sfera, etichette e MEME spariscono.
6. Return / Esc chiudono; al riaprirlo rotazione da zero, linee nuove, pulse continuo.
7. Resize della finestra: la sfera scala, il pulse resta in spazio oggetto.

Hero, nav, crosshair, linea elastica: invariati a GLOBE chiuso.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "$(cat <<'EOF'
docs: record GLOBE radial pulse and skin-anchored labels

EOF
)"
```

---

## Spec coverage (self-review)

| Requisito spec | Task |
|---|---|
| Pulse radiale irregolare, ampiezza 4% | 1 |
| `pulseAmp` / `pulseScale` / `pulseSpeed` e formula `noise` | 1 |
| Riposo non sovrascritto; ricalcolo ogni frame | 1 (`applyPulse`) |
| Linee curve, densità ~650, estremi spostati | 1 |
| Follow cursore invariato; ordine rotazione poi pelle | 1 |
| MEME e A1–H12 sullo stesso campo; hide su z spostato | 2 |
| Reset non azzera il respiro | 1 (non toccare `pulseT`) + 2 step 4 |
| Niente `screenX/Y/Z`; proiezione manuale | 2 |
| Fuori scope UI / busto / nuovi file | vincoli globali |
| Verifica a occhio, 6 punti spec | 3 |
