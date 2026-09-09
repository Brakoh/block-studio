# GLOBE — sfera viva (nube che respira)

Data: 2026-09-09
Stato: approvato in brainstorming, in attesa di review sulla spec scritta

## Problema

La sfera GLOBE è una nube di punti con linee curve, ma sta ferma. Serve un look più vivo: la superficie deve pulsare a zone, senza smettere di leggere come sfera e senza cambiare il resto del sito.

## Obiettivo

I punti si allontanano e si riavvicinano al centro in modo irregolare (bolle lente, non un respiro unico). Linee curve, pulsante MEME e etichette A1–H12 restano ancorati a quella pelle. La sfera continua a seguire il cursore come oggi.

Criterio di successo: a GLOBE aperto si sente il respiro, la forma resta una sfera, linee/MEME/coordinate si muovono con i punti, Return/Esc funzionano come ora.

## Fuori scope

- Hero, nav, crosshair, linea elastica del cursore, overlay GLOBE, Return, Esc
- Modello 3D del busto (`BustBaseMesh_Decimated.obj`)
- Uso di `screenX` / `screenY` / `screenZ` di p5 WEBGL
- Nuove sezioni del sito, nuovi pulsanti, cambio palette o font

## Comportamento visivo

### Punti

Ogni punto ha una posizione di riposo sulla sfera. A ogni frame si sposta **solo in radiale** (lungo il raggio dal centro): alcune zone si alzano, altre si abbassano, in tempi diversi.

- Ampiezza: **4%** del raggio di riposo (via di mezzo tra sottile e media)
- Motore: un unico campo di rumore 3D lento, campionato sulla posizione di riposo + il tempo
- La forma globale resta una sfera: niente schiacciamenti laterali, niente “macchia”

### Linee

Restano **curve**, con il sistema già in uso (estremi, vita, curvatura, nascere/morire, densità attuale circa 650). Non tornano dritte. Non si toglie l’animazione a coda/respiro già presente sulle linee.

Gli estremi sono i punti **già spostati**: le curve si stirano e si piegano con le bolle.

### MEME e coordinate

MEME (ancorato a D4) e le 96 etichette A1–H12 usano **lo stesso campo** dei punti. Restano sulla pelle, non sulla sfera ideale. Quando una zona si alza, etichetta e MEME si alzano con lei.

Il nascondersi quando il punto è dietro la sfera, o quando GLOBE è chiuso, resta com’è — calcolato sulla posizione **spostata**.

### Cursore

La rotazione verso il mouse (`sway` / `follow`) non cambia. Ordine: prima la rotazione della sfera, poi il disegno della pelle viva.

### Reset all’apertura

Click su BLOCK: rotazione a zero, linee che ripartono, come ora. Il respiro dei punti **non** si azzera: è continuo.

## Architettura

Tutto resta nel secondo script di `index.html` (p5 WEBGL). Un solo file, nessun modulo nuovo.

### Campo di spostamento (un’unità)

Una funzione unica, usata da punti, linee (via estremi), etichette e MEME.

- Input: posizione di riposo `(x, y, z)` e tempo
- Output: posizione spostata = riposo × `(1 + pulseAmp × n)` con `pulseAmp = 0.04`
- `n = noise(x * pulseScale, y * pulseScale, z * pulseScale + t) * 2 - 1`, quindi in `[-1, 1]`
- `pulseScale = 2.0`: poche zone larghe sulla sfera, non un brulichio punto-per-punto e non un gonfiore unico
- `t` avanza di `pulseSpeed = 0.004` a ogni frame (~6 secondi per un ciclo di rumore a 60 fps)

Le posizioni di riposo non si sovrascrivono. Lo spostamento si ricalcola ogni frame.

### Punti

`facePts` tiene le coordinate di riposo. In `draw`, per ogni punto si calcola la posizione spostata e si disegna lì.

### Linee

Il sistema linee attuale non cambia struttura: riferimenti a due punti, vita, spawn/recycle, disegno a curva. In disegno, gli estremi sono le posizioni spostate di quei due punti (stesso campo, stesso frame).

### MEME e etichette

`tagAnchor` (D4) e ogni voce di `labelList` tengono il riposo. Prima della proiezione manuale (stesse rotazioni `rotateY(rotY)` + `rotateX(rotX + 0.12)`, fov 60°, `f = (height/2)/tan(PI/6)`), si applica lo stesso spostamento. Poi si decide `display` con lo `z` spostato (`lz2 >= f` → nascosto).

### Dipendenze

- p5.js 1.9.4 WEBGL, già da CDN
- `window.resetGlobe` resta l’unico ponte con lo script UI; il reset non tocca il tempo del rumore

## Casi limite

- GLOBE chiuso: MEME e etichette nascosti; il canvas può continuare a disegnare in background come ora
- Punto/etichetta dietro la sfera: nascosti usando la posizione spostata
- Resize: `windowResized` come ora; lo spostamento è in spazio oggetto, scala con `s`
- Linea senza secondo estremo: si salta, come nello spawn attuale
- Nessun fallback extra: `noise()` è di p5 e il canvas esiste già

## Verifica

Nel browser, GLOBE aperto:

1. La forma resta una sfera, con respiro a zone leggibile ma contenuto
2. Le linee restano curve e seguono i punti
3. MEME e A1–H12 si muovono con le bolle
4. Il follow del cursore è identico a oggi
5. Dietro la sfera, etichette e MEME spariscono ancora
6. Return ed Esc chiudono GLOBE; al riaprirlo la rotazione riparte da zero e le linee si rigenerano; il respiro dei punti è ancora in corso

Niente test automatici: sito single-file, verifica a occhio.

## Parametri da esporre in `FACE_PARAMS`

Aggiungere in `FACE_PARAMS`:

- `pulseAmp: 0.04`
- `pulseScale: 2.0`
- `pulseSpeed: 0.004`

I parametri esistenti di linee, punti, `sway` e `follow` restano. `lineCount` resta quello attuale (~650).
