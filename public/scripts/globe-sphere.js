        /* ---- BLOCK. sphere — point cloud 3D (p5.js) ----
           Parametri grafici regolabili in FACE_PARAMS. */
        const FACE_PARAMS = {
            sizeFactor: 0.3,       // frazione di min(width,height) occupata dalla sfera
            spacing: 0.048,        // distanza tra i punti (più piccolo = più denso)
            jitter: 0.01,          // irregolarità posizionale dei punti
            backSpacing: 0.09,     // non usato
            pointR: 1.2,           // dimensione punti (px)
            backR: 2.0,            // non usato
            eyeR: 4.0,             // non usato
            pupilR: 5.0,           // non usato
            faceAlpha: 0.55,       // opacità punti
            backAlpha: 0.3,        // non usato
            eyeAlpha: 0.85,        // non usato
            pupilAlpha: 1,         // non usato
            sway: 0.18,             // ampiezza rotazione verso il cursore
            follow: 0.04,            // velocità di "inseguimento" del cursore
            lineCount: 72,         // scie attive contemporaneamente
            lineMinSteps: 3,       // distanza min (in passi) tra due punti
            lineMaxSteps: 12,      // distanza max (in passi) tra due punti
            lineWeight: 0.65,     // spessore scia (px)
            lineAlpha: 0.61,      // opacità della testa della scia (−15%)
            lineLife: 96,          // durata media di una scia (frame)
            lineSegs: 14,          // segmenti della curva
            lineBulge: 0.075,      // sollevamento max dal raggio (metà percorso)
        };

        const FP = FACE_PARAMS;
        const facePts = [];
        const lines = [];
        const globeTags = [
            { el: document.getElementById('globe-tag-loudness'), anchor: { x: 0, y: 0, z: 0.35 }, label: 'D4' },
            { el: document.getElementById('globe-tag-overseers'), anchor: { x: 0, y: 0, z: 0.35 }, label: 'E3' },
            { el: document.getElementById('globe-tag-waste'), anchor: { x: 0, y: 0, z: 0.35 }, label: 'E5' },
        ];

        function buildFace() {
            facePts.length = 0;

            const r = 0.9;
            for (let phi = 0; phi <= Math.PI; phi += FP.spacing) {
                const r0 = r * Math.sin(phi);
                const y = r * Math.cos(phi);
                const steps = Math.max(8, Math.round((2 * Math.PI * r0) / FP.spacing));
                for (let i = 0; i < steps; i++) {
                    const theta = (i / steps) * 2 * Math.PI;
                    const jx = (Math.random() - 0.5) * FP.jitter;
                    const jy = (Math.random() - 0.5) * FP.jitter;
                    const jz = (Math.random() - 0.5) * FP.jitter;
                    facePts.push({
                        x: r0 * Math.cos(theta) + jx,
                        y: y + jy,
                        z: r0 * Math.sin(theta) + jz,
                    });
                }
            }
        }

        let homeRotY = 0, homeRotX = -0.12;
        let rotY = 0, rotX = 0;

        function computeHomeRotation() {
            const pts = ['D3', 'D4', 'E3', 'E4']
                .map(n => labelList.find(L => L.label === n))
                .filter(Boolean);
            if (pts.length !== 4) return;
            const c = { x: 0, y: 0, z: 0 };
            for (const p of pts) {
                c.x += p.x;
                c.y += p.y;
                c.z += p.z;
            }
            c.x /= 4;
            c.y /= 4;
            c.z /= 4;
            homeRotY = Math.atan2(-c.x, c.z);
            const z1 = -c.x * Math.sin(homeRotY) + c.z * Math.cos(homeRotY);
            homeRotX = Math.atan2(c.y, z1) - 0.12;
            rotY = homeRotY;
            rotX = homeRotX;
        }

        function distSq(a, b) {
            const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
            return dx * dx + dy * dy + dz * dz;
        }

        function pickPair() {
            const n = facePts.length;
            if (n < 2) return null;
            const maxD = (FP.spacing * FP.lineMaxSteps) ** 2;
            const minD = (FP.spacing * FP.lineMinSteps) ** 2;
            for (let k = 0; k < 160; k++) {
                const a = facePts[(Math.random() * n) | 0];
                const b = facePts[(Math.random() * n) | 0];
                if (a === b) continue;
                const d = distSq(a, b);
                if (d >= minD && d <= maxD) return [a, b];
            }
            const i0 = (Math.random() * n) | 0;
            const a = facePts[i0];
            for (let k = 1; k < n; k++) {
                const b = facePts[(i0 + k) % n];
                const d = distSq(a, b);
                if (d >= minD && d <= maxD) return [a, b];
            }
            return [a, facePts[(i0 + 1) % n]];
        }

        function arcPoint(a, b, t, bulge) {
            const la = Math.hypot(a.x, a.y, a.z) || 1;
            const lb = Math.hypot(b.x, b.y, b.z) || 1;
            const nax = a.x / la, nay = a.y / la, naz = a.z / la;
            const nbx = b.x / lb, nby = b.y / lb, nbz = b.z / lb;
            const dot = Math.max(-1, Math.min(1, nax * nbx + nay * nby + naz * nbz));
            const omega = Math.acos(dot);
            let x, y, z;
            if (omega < 1e-4) {
                x = nax + (nbx - nax) * t;
                y = nay + (nby - nay) * t;
                z = naz + (nbz - naz) * t;
            } else {
                const so = Math.sin(omega);
                const wa = Math.sin((1 - t) * omega) / so;
                const wb = Math.sin(t * omega) / so;
                x = wa * nax + wb * nbx;
                y = wa * nay + wb * nby;
                z = wa * naz + wb * nbz;
            }
            const nrm = Math.hypot(x, y, z) || 1;
            const r = la + (lb - la) * t;
            const elev = 1 + bulge * Math.sin(t * Math.PI);
            const sc = (r * elev) / nrm;
            return { x: x * sc, y: y * sc, z: z * sc };
        }

        function sampleArc(pts, idx) {
            const max = pts.length - 1;
            const i = Math.max(0, Math.min(max, idx));
            const i0 = Math.min(Math.floor(i), max - 1);
            const f = i - i0;
            const p = pts[i0];
            const q = pts[i0 + 1];
            return {
                x: p.x + (q.x - p.x) * f,
                y: p.y + (q.y - p.y) * f,
                z: p.z + (q.z - p.z) * f,
            };
        }

        function spawnLine() {
            const pair = pickPair();
            if (!pair) return false;
            const [a, b] = pair;
            const la = Math.hypot(a.x, a.y, a.z) || 1;
            const lb = Math.hypot(b.x, b.y, b.z) || 1;
            const dot = Math.max(-1, Math.min(1,
                (a.x / la) * (b.x / lb) + (a.y / la) * (b.y / lb) + (a.z / la) * (b.z / lb)));
            const omega = Math.acos(dot);
            const bulge = FP.lineBulge * Math.min(1, omega / 0.45);
            const pts = [];
            for (let i = 0; i <= FP.lineSegs; i++) {
                pts.push(arcPoint(a, b, i / FP.lineSegs, bulge));
            }
            lines.push({
                pts,
                life: FP.lineLife * (0.75 + Math.random() * 0.5),
                age: 0,
                grow: 0.48 + Math.random() * 0.1,
            });
            return true;
        }

        function pickTagAnchor() {
            const R = 0.92;
            for (const tag of globeTags) {
                const picked = labelList.find(L => L.label === tag.label);
                if (!picked) continue;
                const len = Math.hypot(picked.x, picked.y, picked.z) || 1;
                tag.anchor.x = (picked.x / len) * R;
                tag.anchor.y = (picked.y / len) * R;
                tag.anchor.z = (picked.z / len) * R;
            }
        }

        function resetLines() {
            lines.length = 0;
            for (let i = 0; i < FP.lineCount; i++) spawnLine();
            for (const l of lines) l.age = Math.random() * l.life;
        }

        function refillLines() {
            let guard = FP.lineCount + 8;
            while (lines.length < FP.lineCount && guard-- > 0) spawnLine();
        }

        function placeOverlay(el, left, top, show) {
            if (!show) {
                if (el.style.display !== 'none') el.style.display = 'none';
                return;
            }
            if (el.style.display !== 'block') el.style.display = 'block';
            const l = left.toFixed(1);
            const t = top.toFixed(1);
            if (el.dataset.ox !== l || el.dataset.oy !== t) {
                el.dataset.ox = l;
                el.dataset.oy = t;
                el.style.left = l + 'px';
                el.style.top = t + 'px';
            }
        }

        function setup() {
            const c = createCanvas(windowWidth, windowHeight, WEBGL);
            c.id('face-canvas');
            pixelDensity(1);
            buildFace();
            noStroke();
            buildLabels();
            computeHomeRotation();
            resetLines();
            loop();
            pickTagAnchor();

            labelEls.length = 0;
            for (const L of labelList) {
                const d = document.createElement('div');
                d.className = 'coord-globe';
                d.textContent = L.label;
                document.body.appendChild(d);
                labelEls.push({ el: d, p: L });
            }
        }

        const labelList = [];
        const labelEls = [];
        function buildLabels() {
            labelList.length = 0;
            const rings = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
            const cols = 12;
            for (let i = 1; i < rings.length - 1; i++) {
                const phi = Math.PI * (i + 0.5) / rings.length;
                const r0 = 0.9 * Math.sin(phi);
                const yy = 0.9 * Math.cos(phi);
                for (let j = 0; j < cols; j++) {
                    const theta = 2 * Math.PI * (j + 0.5) / cols;
                    labelList.push({
                        x: r0 * Math.cos(theta),
                        y: yy,
                        z: r0 * Math.sin(theta),
                        label: rings[i] + (j + 1),
                    });
                }
            }
        }

        function draw() {
            clear();

            const mx = (typeof cMouseX === 'number') ? cMouseX : width * 0.5;
            const my = (typeof cMouseY === 'number') ? cMouseY : height * 0.5;
            const nx = (mx / width - 0.5) * 2;
            const ny = (my / height - 0.5) * 2;

            const targetRotY = homeRotY + nx * FP.sway;
            const targetRotX = homeRotX - ny * FP.sway * 0.6;
            rotY += (targetRotY - rotY) * FP.follow;
            rotX += (targetRotX - rotX) * FP.follow;

            const s = Math.min(width, height) * FP.sizeFactor * 2;
            push();
            rotateY(rotY);
            rotateX(rotX + 0.12);

            if (!isLooping()) loop();

            for (let i = lines.length - 1; i >= 0; i--) {
                const l = lines[i];
                l.age++;
                if (l.age > l.life) {
                    lines.splice(i, 1);
                    continue;
                }
                const u = l.age / l.life;
                const g = l.grow;
                const head = Math.min(1, u / g);
                const tail = u <= g ? 0 : (u - g) / (1 - g);
                if (head - tail < 0.012) continue;

                const n = l.pts.length - 1;
                const i0 = tail * n;
                const i1 = head * n;
                let prev = sampleArc(l.pts, i0);
                const last = Math.ceil(i1);
                for (let k = Math.floor(i0) + 1; k <= last; k++) {
                    const cur = k >= i1 ? sampleArc(l.pts, i1) : l.pts[k];
                    const tMid = ((k > i1 ? i1 : k) - 0.5 - i0) / (i1 - i0);
                    const fade = 0.18 + 0.82 * Math.max(0, Math.min(1, tMid));
                    strokeWeight(FP.lineWeight * (0.7 + 0.5 * fade));
                    stroke(235, 235, 235, FP.lineAlpha * 255 * fade);
                    line(prev.x * s, prev.y * s, prev.z * s,
                         cur.x * s, cur.y * s, cur.z * s);
                    prev = cur;
                }
            }
            refillLines();

            strokeWeight(FP.pointR * 2);
            stroke(235, 235, 235, FP.faceAlpha * 255);
            beginShape(POINTS);
            for (const p of facePts) {
                vertex(p.x * s, p.y * s, p.z * s);
            }
            endShape();

            pop();

            const aY = rotY;
            const aX = rotX + 0.12;
            const f = (height / 2) / Math.tan(Math.PI / 6);
            const cy = Math.cos(aY), sy = Math.sin(aY);
            const cx = Math.cos(aX), sx = Math.sin(aX);

            for (const tag of globeTags) {
                const px = tag.anchor.x * s, py = tag.anchor.y * s, pz = tag.anchor.z * s;
                const px1 = px * cy + pz * sy;
                const pz1 = -px * sy + pz * cy;
                const py2 = py * cx - pz1 * sx;
                const pz2 = py * sx + pz1 * cx;
                const show = pz2 < f && pz2 > 0;
                placeOverlay(tag.el, width / 2 + (px1 * f) / (f - pz2), height / 2 + (py2 * f) / (f - pz2), show);
            }
            for (let i = 0; i < labelEls.length; i++) {
                const L = labelEls[i];
                const lx = L.p.x * s;
                const ly = L.p.y * s;
                const lz = L.p.z * s;

                const lx1 = lx * cy + lz * sy;
                const lz1 = -lx * sy + lz * cy;
                const ly2 = ly * cx - lz1 * sx;
                const lz2 = ly * sx + lz1 * cx;

                const show = lz2 < f;
                placeOverlay(L.el, width / 2 + (lx1 * f) / (f - lz2), height / 2 + (ly2 * f) / (f - lz2), show);
            }
        }

        function windowResized() {
            resizeCanvas(windowWidth, windowHeight);
        }
    