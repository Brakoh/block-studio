import { createCctvMask } from './overseers-cctv.js';

const CELL = 4;
const FOLLOW = 0.42;
const HOLD = 10;
const LINK_LIFE_MIN = 14;
const LINK_LIFE_MAX = 34;
const MASK_HOLD = 6;
const MASK_FADE = 0.35;
const MASK_OPEN = 0.28;
const MASK_CLOSE = 0.2;
const MASK_OPACITY = 0.75;
const FEED_LEVEL = 0.78;
const BLOB_LINE = { r: 110, g: 232, b: 106 };
const TASKS = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18';
const POSE_MODEL =
	'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const FACE_MODEL =
	'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL =
	'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const MOUTH = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 0, 37, 39, 40, 185];
const LEFT_EAR = [234, 127, 162, 21, 54];
const RIGHT_EAR = [454, 356, 389, 251, 284];
const BRIDGE = [6, 168, 197, 195, 5];
const PALM = [0, 5, 9, 13, 17];
const TIPS = [
	{ i: 4, id: 'thm' },
	{ i: 8, id: 'idx' },
	{ i: 12, id: 'mid' },
	{ i: 16, id: 'rng' },
	{ i: 20, id: 'pky' },
];
const CODE_ROW = 'BCDEFG';

let live = null;

function showCamError(errorEl) {
	errorEl?.classList.add('is-visible');
}

function hideCamError(errorEl) {
	errorEl?.classList.remove('is-visible');
}

function stopStream(stream) {
	if (!stream) return;
	for (const track of stream.getTracks()) track.stop();
}

function keepVideoPlaying(video, stream, signal) {
	video.muted = true;
	video.playsInline = true;
	video.autoplay = true;
	video.setAttribute('playsinline', '');
	video.setAttribute('muted', '');

	let resuming = false;
	const resume = () => {
		if (resuming || document.hidden || !stream?.active) return;
		if (!video.paused && !video.ended) return;
		resuming = true;
		video.play().catch(() => {}).finally(() => {
			resuming = false;
		});
	};

	const opts = { signal };
	video.addEventListener('pause', resume, opts);
	video.addEventListener('ended', resume, opts);
	video.addEventListener('suspend', resume, opts);
	document.addEventListener(
		'visibilitychange',
		() => {
			if (document.visibilityState === 'visible') resume();
		},
		opts,
	);
	return resume;
}

async function startCamera(video, errorEl, signal) {
	if (!navigator.mediaDevices?.getUserMedia) {
		showCamError(errorEl);
		return null;
	}
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 } },
			audio: false,
		});
		video.muted = true;
		video.playsInline = true;
		video.srcObject = stream;
		const resume = keepVideoPlaying(video, stream, signal);
		try {
			await video.play();
		} catch {
			resume();
		}
		hideCamError(errorEl);
		return stream;
	} catch {
		showCamError(errorEl);
		return null;
	}
}

function coverRect(srcW, srcH, dstW, dstH) {
	const srcA = srcW / srcH;
	const dstA = dstW / dstH;
	let w = srcW;
	let h = srcH;
	let x = 0;
	let y = 0;
	if (srcA > dstA) {
		w = srcH * dstA;
		x = (srcW - w) / 2;
	} else {
		h = srcW / dstA;
		y = (srcH - h) / 2;
	}
	return { x, y, w, h };
}

function lineRgba(a) {
	return `rgba(${BLOB_LINE.r},${BLOB_LINE.g},${BLOB_LINE.b},${a})`;
}

function hashStr(s) {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return h >>> 0;
}

function aestheticCode(key) {
	const h = hashStr(key);
	const row = CODE_ROW[h % 6];
	const col = 1 + ((h >>> 5) % 12);
	const hex = ((h >>> 12) & 0xff).toString(16).toUpperCase().padStart(2, '0');
	return `${row}${col}-${hex}`;
}

function offsetFor(key) {
	const h = hashStr(`off:${key}`);
	const ox = (((h >>> 3) % 9) - 4) * 7;
	const oy = (((h >>> 7) % 9) - 4) * 6;
	return { ox: ox || 14, oy: oy || -12 };
}

function seen(lm) {
	return !!(lm && Number.isFinite(lm.x) && Number.isFinite(lm.y));
}

function pick(list, indices) {
	const out = [];
	for (const i of indices) {
		if (seen(list[i])) out.push(list[i]);
	}
	return out;
}

function envelope(pts, pad, minW, minH) {
	if (!pts.length) return null;
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const p of pts) {
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x);
		maxY = Math.max(maxY, p.y);
	}
	const cx = (minX + maxX) / 2;
	const cy = (minY + maxY) / 2;
	const w = Math.max(minW, (maxX - minX) * pad);
	const h = Math.max(minH, (maxY - minY) * pad);
	return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function around(p, w, h) {
	if (!p) return null;
	return { x: p.x - w / 2, y: p.y - h / 2, w, h };
}

function orderQuad(pts) {
	const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
	const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
	return pts
		.slice()
		.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

function alignQuad(prev, next) {
	if (!prev) return next;
	let best = 0;
	let bestD = Infinity;
	for (let s = 0; s < 4; s++) {
		const d = Math.hypot(next[s].x - prev[0].x, next[s].y - prev[0].y);
		if (d < bestD) {
			bestD = d;
			best = s;
		}
	}
	return [0, 1, 2, 3].map((i) => next[(best + i) % 4]);
}

function quadArea(pts) {
	let a = 0;
	for (let i = 0; i < 4; i++) {
		const p = pts[i];
		const q = pts[(i + 1) % 4];
		a += p.x * q.y - q.x * p.y;
	}
	return Math.abs(a) / 2;
}

function minEdge(pts) {
	let m = Infinity;
	for (let i = 0; i < 4; i++) {
		const a = pts[i];
		const b = pts[(i + 1) % 4];
		m = Math.min(m, Math.hypot(b.x - a.x, b.y - a.y));
	}
	return m;
}

function matrixData(entry) {
	if (!entry) return null;
	const data = entry.data ?? entry;
	return data?.length >= 16 ? data : null;
}

async function createModel(Model, url, extra, fileset, delegate) {
	return Model.createFromOptions(fileset, {
		baseOptions: { modelAssetPath: url, delegate },
		runningMode: 'VIDEO',
		...extra,
	});
}

async function loadTrackers() {
	const { FilesetResolver, PoseLandmarker, FaceLandmarker, HandLandmarker } = await import(
		/* @vite-ignore */ `${TASKS}/vision_bundle.mjs`
	);
	const fileset = await FilesetResolver.forVisionTasks(`${TASKS}/wasm`);
	const extras = [
		{ Model: PoseLandmarker, url: POSE_MODEL, extra: { numPoses: 1 } },
		{
			Model: FaceLandmarker,
			url: FACE_MODEL,
			extra: { numFaces: 1, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: true },
		},
		{ Model: HandLandmarker, url: HAND_MODEL, extra: { numHands: 2 } },
	];
	const boot = (delegate) =>
		Promise.all(extras.map((e) => createModel(e.Model, e.url, e.extra, fileset, delegate)));
	try {
		const [pose, face, hands] = await boot('GPU');
		return { pose, face, hands };
	} catch {
		const [pose, face, hands] = await boot('CPU');
		return { pose, face, hands };
	}
}

export async function initOverseers({ canvas, video, errorEl }) {
	if (!canvas || !video) return;

	if (live?.raf) cancelAnimationFrame(live.raf);
	live?.abort?.abort();
	stopStream(live?.stream);
	const abort = new AbortController();
	live = { stream: null, raf: 0, abort };

	const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
	const feed = document.createElement('canvas');
	const fctx = feed.getContext('2d', { alpha: false });
	const tape = document.createElement('canvas');
	const tctx = tape.getContext('2d', { alpha: false });
	const tapeSrc = document.createElement('canvas');
	const sctx = tapeSrc.getContext('2d', { alpha: false });
	const tapePrev = document.createElement('canvas');
	const pctx = tapePrev.getContext('2d', { alpha: false });
	const dpr = Math.min(window.devicePixelRatio || 1, 1.25);

	function drawCover(target, tw, th) {
		const vw = video.videoWidth;
		const vh = video.videoHeight;
		const src = coverRect(vw, vh, tw, th);
		target.save();
		target.imageSmoothingEnabled = true;
		target.setTransform(-1, 0, 0, 1, tw, 0);
		target.drawImage(video, src.x, src.y, src.w, src.h, 0, 0, tw, th);
		target.restore();
	}

	let cols = 1;
	let rows = 1;
	let vhsT = 0;
	let vhsSync = 0;
	let vhsStutter = 0;
	let vhsHoldY = 0;
	let vhsHoldH = 24;
	let vhsHoldX = 0;
	const windows = new Map();
	const links = [];
	let lastVideoTime = -1;
	let lastHands = [];
	let lastHandedness = [];
	let lastFaceMat = null;
	let lastFaceLandmarks = [];
	let lastPoseLandmarks = [];
	let maskQuad = null;
	let maskMiss = 0;
	let maskAlpha = 0;
	let maskWant = 0;
	const faceAnchor = { x: 0, y: 0, s: 160, tx: 0, ty: 0, ts: 160, miss: 99, ok: false };
	let poseTs = 0;
	let faceTs = 0;
	let handTs = 0;
	let detectTick = 0;
	let trackers = null;
	let mapKey = '';
	let mapSrc = null;

	const cctv = createCctvMask(abort.signal);
	cctv.resize(288, 288, 1);

	function sizeCanvas() {
		const w = window.innerWidth;
		const h = window.innerHeight;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		cols = Math.max(2, Math.ceil(w / CELL));
		rows = Math.max(2, Math.ceil(h / CELL));
		feed.width = cols;
		feed.height = rows;
		tape.width = w;
		tape.height = h;
		tapeSrc.width = w;
		tapeSrc.height = h;
		tapePrev.width = w;
		tapePrev.height = h;
	}

	sizeCanvas();
	window.addEventListener('resize', sizeCanvas, { signal: abort.signal });
	video.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;pointer-events:none;z-index:0';

	function videoToScreen(lm, w, h) {
		if (!seen(lm)) return null;
		const vw = video.videoWidth;
		const vh = video.videoHeight;
		if (!vw || !vh) return null;
		const key = `${vw}:${vh}:${w}:${h}`;
		if (key !== mapKey) {
			mapKey = key;
			mapSrc = coverRect(vw, vh, w, h);
		}
		const src = mapSrc;
		const px = lm.x * vw;
		const py = lm.y * vh;
		const u = (px - src.x) / src.w;
		const v = (py - src.y) / src.h;
		if (u < -0.05 || u > 1.05 || v < -0.05 || v > 1.05) return null;
		return { x: (1 - u) * w, y: v * h };
	}

	function pushWin(hits, key, box) {
		if (!box || box.w < 8 || box.h < 8) return;
		hits.push({ key, ...box });
	}

	function collect(w, h) {
		const hits = [];
		if (!trackers || video.readyState < 2) return hits;
		if (video.currentTime === lastVideoTime) {
			for (const t of windows.values()) {
				if (t.miss === 0) hits.push({ key: t.key, x: t.tx, y: t.ty, w: t.tw, h: t.th });
			}
			return hits;
		}
		lastVideoTime = video.currentTime;
		const now = Math.max(1, Math.round(performance.now()));
		detectTick++;

		try {
			handTs = Math.max(handTs + 1, now);
			const handRes = trackers.hands?.detectForVideo(video, handTs);
			if (handRes?.landmarks) {
				lastHands = handRes.landmarks;
				lastHandedness = handRes.handedness ?? [];
			}
		} catch {
			/* hands frame skipped */
		}

		if (detectTick % 2 === 0) {
			try {
				faceTs = Math.max(faceTs + 1, now);
				const faceRes = trackers.face?.detectForVideo(video, faceTs);
				if (faceRes?.faceLandmarks) lastFaceLandmarks = faceRes.faceLandmarks;
				const mat = matrixData(faceRes?.facialTransformationMatrixes?.[0]);
				if (mat) lastFaceMat = mat;
			} catch {
				/* face frame skipped */
			}
		} else {
			try {
				poseTs = Math.max(poseTs + 1, now);
				const poseRes = trackers.pose?.detectForVideo(video, poseTs);
				if (poseRes?.landmarks) lastPoseLandmarks = poseRes.landmarks;
			} catch {
				/* pose frame skipped */
			}
		}

		const faces = lastFaceLandmarks;
		for (let i = 0; i < faces.length; i++) {
			const raw = faces[i];
			const oval = pick(raw, FACE_OVAL).map((lm) => videoToScreen(lm, w, h)).filter(Boolean);
			pushWin(hits, `f${i}-hd`, envelope(oval, 1.18, 110, 130));
			pushWin(hits, `f${i}-le`, envelope(pick(raw, LEFT_EYE).map((lm) => videoToScreen(lm, w, h)).filter(Boolean), 2.4, 70, 42));
			pushWin(hits, `f${i}-re`, envelope(pick(raw, RIGHT_EYE).map((lm) => videoToScreen(lm, w, h)).filter(Boolean), 2.4, 70, 42));
			pushWin(hits, `f${i}-mo`, envelope(pick(raw, MOUTH).map((lm) => videoToScreen(lm, w, h)).filter(Boolean), 1.8, 78, 40));
			pushWin(hits, `f${i}-la`, envelope(pick(raw, LEFT_EAR).map((lm) => videoToScreen(lm, w, h)).filter(Boolean), 2.6, 48, 56));
			pushWin(hits, `f${i}-ra`, envelope(pick(raw, RIGHT_EAR).map((lm) => videoToScreen(lm, w, h)).filter(Boolean), 2.6, 48, 56));
			pushWin(hits, `f${i}-br`, envelope(pick(raw, BRIDGE).map((lm) => videoToScreen(lm, w, h)).filter(Boolean), 3.2, 64, 36));
		}

		const poses = lastPoseLandmarks;
		for (let i = 0; i < poses.length; i++) {
			const p = poses[i];
			const s = (idx) => videoToScreen(p[idx], w, h);
			const ls = s(11);
			const rs = s(12);
			const lh = s(23);
			const rh = s(24);
			pushWin(hits, `p${i}-cl`, envelope([ls, rs, lh, rh].filter(Boolean), 1.22, 120, 140));
			if (ls && rs) {
				const mid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
				const span = Math.hypot(rs.x - ls.x, rs.y - ls.y);
				pushWin(hits, `p${i}-co`, around(mid, Math.max(90, span * 0.42), Math.max(36, span * 0.16)));
			}
			pushWin(hits, `p${i}-ls`, around(s(11), 72, 72));
			pushWin(hits, `p${i}-rs`, around(s(12), 72, 72));
			pushWin(hits, `p${i}-lb`, around(s(13), 64, 64));
			pushWin(hits, `p${i}-rb`, around(s(14), 64, 64));
			pushWin(hits, `p${i}-lw`, around(s(15), 58, 58));
			pushWin(hits, `p${i}-rw`, around(s(16), 58, 58));
			pushWin(hits, `p${i}-lh`, around(s(23), 70, 70));
			pushWin(hits, `p${i}-rh`, around(s(24), 70, 70));
			pushWin(hits, `p${i}-hd`, envelope([s(0), s(2), s(5), s(7), s(8)].filter(Boolean), 1.35, 110, 130));
			if (!faces.length) {
				pushWin(hits, `p${i}-ly`, around(s(2), 70, 42));
				pushWin(hits, `p${i}-ry`, around(s(5), 70, 42));
			}
		}

		const hands = lastHands;
		for (let i = 0; i < hands.length; i++) {
			const raw = hands[i];
			const palm = pick(raw, PALM).map((lm) => videoToScreen(lm, w, h)).filter(Boolean);
			pushWin(hits, `h${i}-pl`, envelope(palm, 1.55, 72, 72));
			for (const tip of TIPS) {
				const pt = videoToScreen(raw[tip.i], w, h);
				pushWin(hits, `h${i}-${tip.id}`, around(pt, 56, 56));
			}
		}

		return hits;
	}

	function settle(hits) {
		const seenKeys = new Set();
		for (const hit of hits) {
			seenKeys.add(hit.key);
			let t = windows.get(hit.key);
			if (!t) {
				const off = offsetFor(hit.key);
				t = {
					key: hit.key,
					code: aestheticCode(hit.key),
					x: hit.x,
					y: hit.y,
					w: hit.w,
					h: hit.h,
					tx: hit.x,
					ty: hit.y,
					tw: hit.w,
					th: hit.h,
					miss: 0,
					...off,
				};
				windows.set(hit.key, t);
			} else {
				t.tx = hit.x;
				t.ty = hit.y;
				t.tw = hit.w;
				t.th = hit.h;
				t.miss = 0;
			}
			t.x += (t.tx - t.x) * FOLLOW;
			t.y += (t.ty - t.y) * FOLLOW;
			t.w += (t.tw - t.w) * FOLLOW;
			t.h += (t.th - t.h) * FOLLOW;
		}
		for (const [key, t] of windows) {
			if (seenKeys.has(key)) continue;
			t.miss++;
			if (t.miss > HOLD) windows.delete(key);
		}
	}

	function polesFromHands(w, h) {
		const sides = { Left: [], Right: [], other: [] };
		for (let i = 0; i < lastHands.length; i++) {
			const raw = lastHands[i];
			const thumb = videoToScreen(raw[4], w, h);
			const index = videoToScreen(raw[8], w, h);
			if (!thumb || !index) continue;
			const label = lastHandedness[i]?.[0]?.categoryName || '';
			const score = lastHandedness[i]?.[0]?.score ?? 0;
			const entry = { thumb, index, score, x: (thumb.x + index.x) / 2 };
			if (label === 'Left' || label === 'Right') sides[label].push(entry);
			else sides.other.push(entry);
		}
		sides.Left.sort((a, b) => b.score - a.score);
		sides.Right.sort((a, b) => b.score - a.score);
		let L = sides.Left[0];
		let R = sides.Right[0];
		if (!L || !R) {
			const pool = [...sides.Left, ...sides.Right, ...sides.other].sort((a, b) => a.x - b.x);
			if (pool.length < 2) return null;
			L = pool[0];
			R = pool[pool.length - 1];
			if (L === R) return null;
		}
		const ordered = orderQuad([L.thumb, L.index, R.index, R.thumb]);
		if (quadArea(ordered) < 8) return null;
		return ordered;
	}

	function settleMask(w, h) {
		const poles = polesFromHands(w, h);
		const span = Math.min(w, h);
		const openAt = span * MASK_OPEN;
		const closeAt = span * MASK_CLOSE;
		if (poles) {
			maskMiss = 0;
			const next = alignQuad(maskQuad, poles);
			if (!maskQuad) maskQuad = next.map((p) => ({ x: p.x, y: p.y }));
			else {
				for (let i = 0; i < 4; i++) {
					maskQuad[i].x += (next[i].x - maskQuad[i].x) * FOLLOW;
					maskQuad[i].y += (next[i].y - maskQuad[i].y) * FOLLOW;
				}
			}
			const spread = minEdge(maskQuad);
			const need = maskWant >= 1 ? closeAt : openAt;
			maskWant = spread >= need ? 1 : 0;
		} else {
			maskMiss++;
			if (maskMiss > MASK_HOLD) maskWant = 0;
		}
		const k = maskWant > maskAlpha ? MASK_FADE : MASK_FADE * 1.15;
		maskAlpha += (maskWant - maskAlpha) * k;
		if (maskAlpha < 0.012 && maskWant === 0) {
			maskAlpha = 0;
			if (!poles && maskMiss > MASK_HOLD) maskQuad = null;
		}
	}

	function settleFace(w, h) {
		let box = null;
		const raw = lastFaceLandmarks[0];
		if (raw) {
			const oval = pick(raw, FACE_OVAL).map((lm) => videoToScreen(lm, w, h)).filter(Boolean);
			box = envelope(oval, 1.05, 80, 90);
		}
		if (!box && lastPoseLandmarks[0]) {
			const p = lastPoseLandmarks[0];
			const s = (idx) => videoToScreen(p[idx], w, h);
			box = envelope([s(0), s(2), s(5), s(7), s(8)].filter(Boolean), 1.25, 80, 90);
		}
		if (box) {
			faceAnchor.tx = box.x + box.w / 2;
			faceAnchor.ty = box.y + box.h / 2;
			faceAnchor.ts = Math.max(box.w, box.h);
			faceAnchor.miss = 0;
		} else {
			faceAnchor.miss++;
		}
		if (faceAnchor.miss > HOLD) {
			faceAnchor.ok = false;
			return;
		}
		if (!faceAnchor.ok) {
			faceAnchor.x = faceAnchor.tx;
			faceAnchor.y = faceAnchor.ty;
			faceAnchor.s = faceAnchor.ts;
			faceAnchor.ok = faceAnchor.miss === 0;
			return;
		}
		faceAnchor.x += (faceAnchor.tx - faceAnchor.x) * FOLLOW;
		faceAnchor.y += (faceAnchor.ty - faceAnchor.y) * FOLLOW;
		faceAnchor.s += (faceAnchor.ts - faceAnchor.s) * FOLLOW;
	}

	function traceMask() {
		ctx.beginPath();
		ctx.moveTo(maskQuad[0].x, maskQuad[0].y);
		ctx.lineTo(maskQuad[1].x, maskQuad[1].y);
		ctx.lineTo(maskQuad[2].x, maskQuad[2].y);
		ctx.lineTo(maskQuad[3].x, maskQuad[3].y);
		ctx.closePath();
	}

	function drawMask(w, h) {
		if (!maskQuad || maskAlpha <= 0.01) return;
		if (lastFaceMat) cctv.setHeadFromMatrix(lastFaceMat);
		cctv.render();

		ctx.save();
		ctx.globalAlpha = maskAlpha * MASK_OPACITY;
		traceMask();
		ctx.clip();
		ctx.fillStyle = '#000';
		ctx.fill();
		if (faceAnchor.ok) {
			const draw = Math.max(200, faceAnchor.s * 2.85);
			ctx.drawImage(cctv.canvas, faceAnchor.x - draw / 2, faceAnchor.y - draw / 2, draw, draw);
		}
		ctx.restore();

		ctx.save();
		ctx.globalAlpha = maskAlpha * MASK_OPACITY;
		traceMask();
		ctx.strokeStyle = lineRgba(1);
		ctx.lineWidth = 1;
		ctx.lineJoin = 'miter';
		ctx.lineCap = 'square';
		ctx.stroke();
		ctx.restore();
	}

	function drawIdle() {
		const w = window.innerWidth;
		const h = window.innerHeight;
		ctx.fillStyle = '#0a0a0a';
		ctx.fillRect(0, 0, w, h);
	}

	function applyVhs(w, h) {
		vhsT++;
		vhsSync = (vhsSync + 9.2 + (vhsT % 28 === 0 ? 36 : 0)) % (h + 48);

		tctx.drawImage(tapeSrc, 0, 0);

		if (vhsT % 2 === 0) {
			tctx.save();
			tctx.globalAlpha = 0.11;
			tctx.drawImage(tapeSrc, 2, 0);
			tctx.restore();
		}

		const tearY = ((vhsSync % h) + h) % h;
		const tearH = 10 + (vhsT % 14);
		const jitter = ((vhsT * 19) % 15) - 7;
		const shift = 12 + jitter + (vhsT % 19 === 0 ? 28 : 0);
		tctx.drawImage(tapeSrc, 0, tearY, w, tearH, shift, tearY, w, tearH);
		if (vhsT % 11 === 0) {
			const y2 = (tearY + 28 + (vhsT % 40)) % h;
			tctx.drawImage(tapeSrc, 0, y2, w, 7, -shift * 0.7, y2, w, 7);
		}

		if (vhsStutter > 0) {
			tctx.drawImage(tapePrev, vhsHoldX, vhsHoldY, w, vhsHoldH, vhsHoldX, vhsHoldY, w, vhsHoldH);
			tctx.drawImage(
				tapePrev,
				0,
				vhsHoldY,
				w,
				vhsHoldH,
				vhsHoldX + shift * 0.35,
				vhsHoldY,
				w,
				vhsHoldH,
			);
			vhsStutter--;
		} else if (vhsT % 22 === 0) {
			pctx.drawImage(tape, 0, 0);
			vhsStutter = 3 + (vhsT % 2);
			vhsHoldY = tearY;
			vhsHoldH = 16 + (vhsT % 22);
			vhsHoldX = ((vhsT * 7) % 21) - 10;
		}

		const barY = tearY;
		tctx.fillStyle = 'rgba(0,0,0,0.28)';
		tctx.fillRect(0, barY, w, 3);
		tctx.fillStyle = 'rgba(232,232,232,0.1)';
		tctx.fillRect(0, barY + 3, w, 2);

		if (vhsT % 4 === 0) {
			tctx.fillStyle = 'rgba(232,232,232,0.16)';
			tctx.fillRect(0, (vhsT * 37) % h, w, 1);
			tctx.fillStyle = 'rgba(0,0,0,0.2)';
			tctx.fillRect(0, (vhsT * 53) % h, w, 1);
		}
	}

	function drawFeed(w, h) {
		const vw = video.videoWidth;
		const vh = video.videoHeight;
		if (!vw || !vh) return false;

		fctx.filter = `grayscale(1) contrast(1.12) brightness(${FEED_LEVEL})`;
		fctx.imageSmoothingEnabled = true;
		drawCover(fctx, cols, rows);
		fctx.filter = 'none';

		sctx.imageSmoothingEnabled = false;
		sctx.drawImage(feed, 0, 0, w, h);
		applyVhs(w, h);

		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(tape, 0, 0, w, h);
		ctx.fillStyle = 'rgba(0,0,0,0.2)';
		for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
		return true;
	}

	function centerOf(t) {
		return { x: t.x + t.w / 2, y: t.y + t.h / 2 };
	}

	function pickLinkPair(list) {
		const n = list.length;
		if (n < 2) return null;
		const a = list[(Math.random() * n) | 0];
		const ca = centerOf(a);
		const scored = [];
		for (const b of list) {
			if (b.key === a.key) continue;
			const cb = centerOf(b);
			scored.push({ b, d: Math.hypot(cb.x - ca.x, cb.y - ca.y) });
		}
		if (!scored.length) return null;
		scored.sort((x, y) => x.d - y.d);
		const far = Math.random() < 0.22 && scored.length > 3;
		const pool = far ? scored : scored.slice(0, Math.min(4, scored.length));
		return [a, pool[(Math.random() * pool.length) | 0].b];
	}

	function tickLinks(list) {
		const liveKeys = new Set(list.map((t) => t.key));
		for (let i = links.length - 1; i >= 0; i--) {
			const L = links[i];
			L.life++;
			if (L.life > L.max || !liveKeys.has(L.ak) || !liveKeys.has(L.bk)) {
				links.splice(i, 1);
			}
		}
		const want = Math.min(36, Math.max(0, Math.round(list.length * 1.8)));
		let guard = 40;
		while (links.length < want && guard-- > 0) {
			const pair = pickLinkPair(list);
			if (!pair) break;
			const [a, b] = pair;
			if (links.some((L) => (L.ak === a.key && L.bk === b.key) || (L.ak === b.key && L.bk === a.key))) {
				continue;
			}
			links.push({
				ak: a.key,
				bk: b.key,
				life: 0,
				max: LINK_LIFE_MIN + ((Math.random() * (LINK_LIFE_MAX - LINK_LIFE_MIN)) | 0),
			});
		}
	}

	function drawLinks(list) {
		const byKey = new Map(list.map((t) => [t.key, t]));
		ctx.save();
		ctx.lineWidth = 1;
		ctx.lineCap = 'square';
		ctx.lineJoin = 'miter';
		for (const L of links) {
			const a = byKey.get(L.ak);
			const b = byKey.get(L.bk);
			if (!a || !b) continue;
			const ca = centerOf(a);
			const cb = centerOf(b);
			const u = L.life / L.max;
			const envelope = Math.sin(u * Math.PI);
			const fade = (a.miss || b.miss ? 0.35 : 1) * (0.35 + 0.65 * envelope);
			ctx.strokeStyle = lineRgba(fade);
			ctx.beginPath();
			ctx.moveTo(ca.x, ca.y);
			ctx.lineTo(cb.x, cb.y);
			ctx.stroke();
		}
		ctx.restore();
	}

	function drawWindows(w, h) {
		const list = [...windows.values()].sort((a, b) => b.w * b.h - a.w * a.h);
		tickLinks(list);
		drawLinks(list);
		ctx.save();
		ctx.lineJoin = 'miter';
		ctx.lineCap = 'square';
		ctx.font = '11px "Space Mono", monospace';
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'left';

		for (const t of list) {
			const fade = t.miss ? 0.4 : 1;
			const x = t.x;
			const y = t.y;
			const bw = t.w;
			const bh = t.h;
			const sx = Math.max(0, Math.min(w - 1, x + t.ox));
			const sy = Math.max(0, Math.min(h - 1, y + t.oy));
			const sw = Math.max(1, Math.min(w - sx, bw));
			const sh = Math.max(1, Math.min(h - sy, bh));
			ctx.save();
			ctx.beginPath();
			ctx.rect(x, y, bw, bh);
			ctx.clip();
			ctx.imageSmoothingEnabled = false;
			ctx.globalAlpha = fade;
			ctx.drawImage(tape, sx, sy, sw, sh, x, y, bw, bh);
			ctx.restore();

			ctx.globalAlpha = fade;
			ctx.strokeStyle = lineRgba(1);
			ctx.lineWidth = 1;
			ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);

			const label = t.code;
			const tw = ctx.measureText(label).width;
			const padX = 7;
			const lh = 18;
			const barW = tw + padX * 2;
			let ly = y - lh;
			if (ly < 8) ly = y + bh;
			ctx.fillStyle = '#000';
			ctx.fillRect(x, ly, barW, lh);
			ctx.strokeStyle = lineRgba(1);
			ctx.lineWidth = 1;
			ctx.strokeRect(x + 0.5, ly + 0.5, barW - 1, lh - 1);
			ctx.fillStyle = '#e8e8e8';
			ctx.fillText(label, x + padX, ly + lh / 2);
			ctx.globalAlpha = 1;
		}
		ctx.restore();
	}

	function frame() {
		if (live.abort !== abort) return;
		const w = window.innerWidth;
		const h = window.innerHeight;
		if (!stream || !video.videoWidth) {
			drawIdle();
		} else {
			settle(collect(w, h));
			settleMask(w, h);
			settleFace(w, h);
			if (drawFeed(w, h)) {
				drawWindows(w, h);
				drawMask(w, h);
			} else drawIdle();
		}
		live.raf = requestAnimationFrame(frame);
	}

	const stream = await startCamera(video, errorEl, abort.signal);
	if (live.abort !== abort) {
		stopStream(stream);
		return;
	}
	live.stream = stream;
	live.raf = requestAnimationFrame(frame);

	if (stream) {
		try {
			trackers = await loadTrackers();
		} catch {
			trackers = null;
		}
	}

	abort.signal.addEventListener('abort', () => {
		if (live?.raf) cancelAnimationFrame(live.raf);
		stopStream(live?.stream);
		trackers?.pose?.close?.();
		trackers?.face?.close?.();
		trackers?.hands?.close?.();
		cctv.dispose();
	});

	if (import.meta.hot) {
		import.meta.hot.dispose(() => {
			live?.abort?.abort();
			if (live?.raf) cancelAnimationFrame(live.raf);
			stopStream(live?.stream);
			live = null;
		});
	}
}
