const INTERACTIVE_SEL = 'a, button, input, select, textarea, [role="link"], .hero h1';

function setCursorCoords(crosshair, crosshairCoord, x, y) {
    crosshair.style.left = x + 'px';
    crosshair.style.top = y + 'px';
    const lat = (51.5 + (y / window.innerHeight) * 0.02).toFixed(4);
    const lng = (0.12 + (x / window.innerWidth) * 0.02).toFixed(4);
    crosshairCoord.textContent = `${lat}° N, ${lng}° W`;
}

export function initStudioUI({ magnet = true, parkCursor = false, line = true, pinnedHitbox = null } = {}) {
    const crosshair = document.getElementById('crosshair');
    const crosshairCoord = document.getElementById('crosshair-coord');
    const anchorCanvas = document.getElementById('anchor-line');
    const anchorCtx = anchorCanvas.getContext('2d');
    const aDpr = window.devicePixelRatio || 1;

    let parkedCursor = parkCursor;
    const parkUntil = performance.now() + 200;
    function shouldHoldCenter() {
        if (!parkedCursor) return false;
        if (performance.now() < parkUntil) return true;
        parkedCursor = false;
        return false;
    }

    function sizeAnchorCanvas() {
        anchorCanvas.width = window.innerWidth * aDpr;
        anchorCanvas.height = window.innerHeight * aDpr;
        anchorCanvas.style.width = window.innerWidth + 'px';
        anchorCanvas.style.height = window.innerHeight + 'px';
        anchorCtx.setTransform(aDpr, 0, 0, aDpr, 0, 0);
    }
    sizeAnchorCanvas();
    window.addEventListener('resize', sizeAnchorCanvas);

    let anchorList = [];
    function collectInteractive() {
        anchorList = Array.from(document.querySelectorAll(INTERACTIVE_SEL))
            .map((el) => ({ el, x: 0, y: 0, l: 0, t: 0, r: 0, b: 0, w: 0, h: 0 }));
        updateAnchorPositions();
    }
    function updateAnchorPositions() {
        for (const a of anchorList) {
            const r = a.el.getBoundingClientRect();
            a.l = r.left; a.t = r.top; a.r = r.right; a.b = r.bottom;
            a.w = r.width; a.h = r.height;
            a.x = r.left + r.width / 2;
            a.y = r.top + r.height / 2;
        }
    }
    collectInteractive();
    window.addEventListener('resize', collectInteractive);

    let cMouseX = window.innerWidth / 2;
    let cMouseY = window.innerHeight / 2;
    window.cMouseX = cMouseX;
    window.cMouseY = cMouseY;
    let lineX = cMouseX;
    let lineY = cMouseY;
    let targetCurrent = null;
    let anchorRaf = 0;
    let canvasHasLine = false;
    let lastHovering = false;

    function requestAnchorDraw() {
        if (!anchorRaf) anchorRaf = requestAnimationFrame(anchorDraw);
    }

    window.requestAnchorDraw = requestAnchorDraw;

    function placeCursor(x, y) {
        cMouseX = x;
        cMouseY = y;
        window.cMouseX = x;
        window.cMouseY = y;
        lineX = x;
        lineY = y;
        setCursorCoords(crosshair, crosshairCoord, x, y);
    }

    if (parkCursor) {
        placeCursor(window.innerWidth / 2, window.innerHeight / 2);
    }
    if (magnet || pinnedHitbox) requestAnchorDraw();

    document.addEventListener('mousemove', (e) => {
        if (shouldHoldCenter()) return;
        setCursorCoords(crosshair, crosshairCoord, e.clientX, e.clientY);
        if (parkedCursor) return;
        cMouseX = e.clientX;
        cMouseY = e.clientY;
        window.cMouseX = e.clientX;
        window.cMouseY = e.clientY;
        requestAnchorDraw();
    });

    window.addEventListener('scroll', () => {
        updateAnchorPositions();
        if (magnet || pinnedHitbox) requestAnchorDraw();
    }, { passive: true });

    function pointInA(a, x, y) {
        return a.w > 0 && x >= a.l && x <= a.r && y >= a.t && y <= a.b;
    }

    function boxFromEl(el) {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return null;
        return {
            el,
            l: r.left,
            t: r.top,
            r: r.right,
            b: r.bottom,
            w: r.width,
            h: r.height,
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
        };
    }

    function drawHitbox(box, pulse) {
        const pad = 6;
        const ox = box.l - pad;
        const oy = box.t - pad;
        const w = box.w + pad * 2;
        const h = box.h + pad * 2;
        anchorCtx.strokeStyle = `rgba(255,255,255,${(0.22 + 0.1 * pulse).toFixed(3)})`;
        anchorCtx.lineWidth = 1;
        anchorCtx.strokeRect(ox, oy, w, h);
        const c = 9;
        anchorCtx.strokeStyle = `rgba(255,255,255,${(0.4 + 0.18 * pulse).toFixed(3)})`;
        [[ox, oy, 1, 1], [ox + w, oy, -1, 1], [ox, oy + h, 1, -1], [ox + w, oy + h, -1, -1]].forEach(([x, y, dx2, dy2]) => {
            anchorCtx.beginPath();
            anchorCtx.moveTo(x + c * dx2, y);
            anchorCtx.lineTo(x, y);
            anchorCtx.lineTo(x, y + c * dy2);
            anchorCtx.stroke();
        });
        return { ox, oy, w, h };
    }

    function drawLineTo(tgt) {
        const targetX = tgt.x;
        const targetY = tgt.y;
        const dx = targetX - lineX;
        const dy = targetY - lineY;
        const jerk = 0.16;
        lineX += dx * jerk;
        lineY += dy * jerk;

        const cx = (lineX + targetX) / 2 + (lineY - targetY) * 0.28;
        const cy = (lineY + targetY) / 2 - (lineX - targetX) * 0.28;
        const { ox, oy, w, h } = {
            ox: tgt.l - 6,
            oy: tgt.t - 6,
            w: tgt.w + 12,
            h: tgt.h + 12,
        };

        anchorCtx.save();
        anchorCtx.beginPath();
        anchorCtx.rect(0, 0, window.innerWidth, window.innerHeight);
        anchorCtx.rect(ox, oy, w, h);
        anchorCtx.clip('evenodd');
        anchorCtx.strokeStyle = 'rgba(255,255,255,0.35)';
        anchorCtx.lineWidth = 1;
        anchorCtx.beginPath();
        anchorCtx.moveTo(cMouseX, cMouseY);
        anchorCtx.quadraticCurveTo(cx, cy, targetX, targetY);
        anchorCtx.stroke();
        anchorCtx.restore();
    }

    function anchorDraw() {
        anchorRaf = 0;
        updateAnchorPositions();

        let best = null;
        let bestD = Infinity;
        let hoverA = null;
        for (const a of anchorList) {
            if (a.w <= 0 || a.h <= 0) continue;
            if (magnet) {
                const d = Math.hypot(a.x - cMouseX, a.y - cMouseY);
                if (d < bestD) {
                    bestD = d;
                    best = a;
                }
            }
            if (pointInA(a, cMouseX, cMouseY)) hoverA = a;
        }

        if (magnet) {
            const MAX_RANGE = Math.max(300, window.innerWidth * 0.45);
            targetCurrent = (best && bestD < MAX_RANGE ? best : null);
        } else {
            targetCurrent = hoverA;
        }

        const hovering = magnet
            ? !!(hoverA && targetCurrent === hoverA)
            : !!hoverA;
        if (hovering !== lastHovering) {
            crosshair.classList.toggle('active', hovering);
            lastHovering = hovering;
        }

        const pinned = pinnedHitbox ? boxFromEl(document.querySelector(pinnedHitbox)) : null;
        const tgt = targetCurrent;
        const boxes = [];
        if (pinned) boxes.push(pinned);
        if (tgt && tgt.el !== pinned?.el && !pinned?.el?.contains(tgt.el)) boxes.push(tgt);

        if (!boxes.length && !tgt) {
            lineX = cMouseX;
            lineY = cMouseY;
            if (canvasHasLine) {
                anchorCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
                canvasHasLine = false;
            }
            return;
        }

        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400);
        anchorCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        canvasHasLine = true;

        if (line && tgt) drawLineTo(tgt);
        else {
            lineX = cMouseX;
            lineY = cMouseY;
        }

        for (const box of boxes) drawHitbox(box, pulse);
        requestAnchorDraw();
    }
}

export function initScrollReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const nodes = [...document.querySelectorAll('.reveal')];
    if (!nodes.length) return;

    const byParent = new Map();
    for (const el of nodes) {
        const parent = el.parentElement;
        if (!byParent.has(parent)) byParent.set(parent, []);
        byParent.get(parent).push(el);
    }
    for (const group of byParent.values()) {
        group.forEach((el, i) => {
            el.style.setProperty('--reveal-delay', `${i * 90}ms`);
        });
    }

    const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
        }
    }, { threshold: 0.14, rootMargin: '0px 0px -12% 0px' });

    for (const el of nodes) io.observe(el);
}

export function startUtcClock(el) {
    if (!el) return;
    function updateTime() {
        const now = new Date();
        el.textContent = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    }
    updateTime();
    setInterval(updateTime, 1000);
}

export function resetHomeScroll() {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    if (location.hash) {
        history.replaceState(null, '', location.pathname + location.search);
    }
    window.scrollTo(0, 0);

    function blockAutoScroll() {
        window.scrollTo(0, 0);
    }
    window.addEventListener('scroll', blockAutoScroll, { passive: true });
    window.addEventListener('load', () => {
        window.scrollTo(0, 0);
        setTimeout(() => window.scrollTo(0, 0), 0);
        setTimeout(() => window.scrollTo(0, 0), 50);
        setTimeout(() => window.scrollTo(0, 0), 100);
    });
    setTimeout(() => {
        window.removeEventListener('scroll', blockAutoScroll, { passive: true });
    }, 300);
}
