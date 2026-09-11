const TYPES = ['barrier', 'hoarding', 'boxes', 'scooter', 'tarp'];
const PALM = [0, 5, 9, 13, 17];
const TASKS = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18';
const MODEL =
	'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

function mulberry32(seed) {
	return function rand() {
		let t = (seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function clamp(v, a, b) {
	return Math.max(a, Math.min(b, v));
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function hexRgb(hex) {
	const n = parseInt(hex.slice(1), 16);
	return [n >> 16, (n >> 8) & 255, n & 255];
}

function mixHex(a, b, t) {
	const A = hexRgb(a);
	const B = hexRgb(b);
	const r = Math.round(A[0] + (B[0] - A[0]) * t);
	const g = Math.round(A[1] + (B[1] - A[1]) * t);
	const bl = Math.round(A[2] + (B[2] - A[2]) * t);
	return `rgb(${r},${g},${bl})`;
}

function wrapAngle(d) {
	while (d > Math.PI) d -= Math.PI * 2;
	while (d < -Math.PI) d += Math.PI * 2;
	return d;
}

function project(nx, ny, W, H) {
	const side = Math.min(W, H) * 1.05;
	const ox = (W - side) / 2;
	const oy = (H - side) / 2 + H * 0.03;
	return [ox + nx * side, oy + ny * side];
}

function buildPieces(hoarding) {
	const rand = mulberry32(0xb10c);
	const near = [
		{ type: 'tarp', restX: 0.42, restY: 0.68, restRot: -0.42, scale: 1.35, lag: 0 },
		{ type: 'hoarding', restX: 0.47, restY: 0.58, restRot: 0.05, scale: 1.22, lag: 0.02 },
		{ type: 'barrier', restX: 0.5, restY: 0.72, restRot: 0.04, scale: 1.1, lag: 0.04 },
		{ type: 'boxes', restX: 0.58, restY: 0.61, restRot: -0.14, scale: 1.12, lag: 0.05 },
		{ type: 'scooter', restX: 0.55, restY: 0.75, restRot: 0.52, scale: 1.18, lag: 0.03 },
	];
	const far = [];
	for (let i = 0; i < 48; i++) {
		const a = rand() * Math.PI * 2;
		const r = Math.sqrt(rand()) * 0.08;
		const pileH = (1 - r / 0.08) * 0.16;
		far.push({
			type: TYPES[i % TYPES.length],
			restX: 0.47 + Math.cos(a) * r * 1.15,
			restY: 0.65 + Math.sin(a) * r * 0.45 - pileH,
			restRot: (rand() - 0.5) * 1.8,
			scale: 0.55 + rand() * 0.32,
			lag: 0.08 + rand() * 0.22,
		});
	}
	return [...far, ...near].map((p) => {
		const drift = (rand() - 0.5) * 0.55;
		return {
			...p,
			hoarding,
			spawnX: p.restX + drift,
			spawnY: p.restY - (0.72 + rand() * 0.35),
			spawnRot: p.restRot + (rand() - 0.5) * 2.4,
		};
	});
}

function poseOf(piece, rewind) {
	const span = 1 - piece.lag;
	const local = clamp((rewind - piece.lag) / span, 0, 1);
	const p = 1 - local;
	const e = p * p;
	return {
		x: lerp(piece.spawnX, piece.restX, e),
		y: lerp(piece.spawnY, piece.restY, e),
		rot: lerp(piece.spawnRot, piece.restRot, e),
		scale: piece.scale,
		alpha: 0.25 + 0.75 * (1 - local * 0.2),
		type: piece.type,
		hoarding: piece.hoarding,
	};
}

function drawBarrier(ctx) {
	ctx.fillRect(-36, -22, 6, 44);
	ctx.fillRect(30, -22, 6, 44);
	ctx.fillRect(-36, -16, 72, 5);
	ctx.fillRect(-36, -2, 72, 5);
	ctx.fillRect(-36, 12, 72, 5);
}

function drawHoarding(ctx, label) {
	ctx.fillRect(-28, -40, 56, 72);
	ctx.strokeRect(-28, -40, 56, 72);
	ctx.fillRect(-28, -40, 56, 8);
	if (label && ctx.getTransform().a > 0.7) {
		ctx.save();
		ctx.fillStyle = 'rgba(232,232,232,0.85)';
		ctx.font = '7px "Space Mono", monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, 0, -4);
		ctx.restore();
	}
}

function drawBoxes(ctx) {
	ctx.fillRect(-10, 2, 28, 20);
	ctx.strokeRect(-10, 2, 28, 20);
	ctx.fillRect(-22, -14, 26, 20);
	ctx.strokeRect(-22, -14, 26, 20);
	ctx.fillRect(-4, -28, 22, 18);
	ctx.strokeRect(-4, -28, 22, 18);
}

function drawScooter(ctx) {
	ctx.beginPath();
	ctx.ellipse(-22, 8, 7, 7, 0, 0, Math.PI * 2);
	ctx.ellipse(20, 8, 7, 7, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillRect(-22, 2, 42, 6);
	ctx.fillRect(16, -26, 5, 34);
	ctx.fillRect(4, -28, 22, 5);
}

function drawTarp(ctx) {
	ctx.beginPath();
	ctx.moveTo(-40, 6);
	ctx.quadraticCurveTo(-18, -18, 4, -8);
	ctx.quadraticCurveTo(28, 6, 38, -2);
	ctx.quadraticCurveTo(22, 22, -6, 16);
	ctx.quadraticCurveTo(-32, 20, -40, 6);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
}

function drawPiece(ctx, pose, fill, stroke) {
	ctx.save();
	ctx.translate(pose.x, pose.y);
	ctx.rotate(pose.rot);
	ctx.scale(pose.scale, pose.scale);
	ctx.globalAlpha *= pose.alpha;
	ctx.fillStyle = fill;
	ctx.strokeStyle = stroke;
	ctx.lineWidth = 1 / Math.max(pose.scale, 0.25);
	if (pose.type === 'barrier') drawBarrier(ctx);
	else if (pose.type === 'hoarding') drawHoarding(ctx, pose.hoarding);
	else if (pose.type === 'boxes') drawBoxes(ctx);
	else if (pose.type === 'scooter') drawScooter(ctx);
	else drawTarp(ctx);
	ctx.restore();
}

function drawPlinth(ctx, x, y, g) {
	const w = 54;
	const d = 28;
	const h = 70;
	const sx = d * 0.45;
	const fl = [x - w / 2, y];
	const fr = [x + w / 2, y];
	const bl = [x - w / 2 + sx, y - d];
	const br = [x + w / 2 + sx, y - d];
	const top = h;

	ctx.fillStyle = mixHex('#1a1a1a', '#6e4c3a', g);
	ctx.beginPath();
	ctx.moveTo(fl[0], fl[1] - top);
	ctx.lineTo(fr[0], fr[1] - top);
	ctx.lineTo(fr[0], fr[1]);
	ctx.lineTo(fl[0], fl[1]);
	ctx.closePath();
	ctx.fill();

	ctx.fillStyle = mixHex('#222222', '#8a6550', g);
	ctx.beginPath();
	ctx.moveTo(fr[0], fr[1] - top);
	ctx.lineTo(br[0], br[1] - top);
	ctx.lineTo(br[0], br[1]);
	ctx.lineTo(fr[0], fr[1]);
	ctx.closePath();
	ctx.fill();

	ctx.fillStyle = mixHex('#2c2c2c', '#a07860', g);
	ctx.beginPath();
	ctx.moveTo(fl[0], fl[1] - top);
	ctx.lineTo(fr[0], fr[1] - top);
	ctx.lineTo(br[0], br[1] - top);
	ctx.lineTo(bl[0], bl[1] - top);
	ctx.closePath();
	ctx.fill();

	ctx.strokeStyle = mixHex('#4c4c4c', '#d2b08c', g);
	ctx.lineWidth = 1;
	ctx.stroke();

	const inset = 10;
	ctx.fillStyle = mixHex('#121212', '#3a241c', g);
	ctx.beginPath();
	ctx.moveTo(fl[0] + inset, fl[1] - top + 4);
	ctx.lineTo(fr[0] - inset + 4, fr[1] - top + 4);
	ctx.lineTo(br[0] - inset, br[1] - top + 8);
	ctx.lineTo(bl[0] + inset, bl[1] - top + 8);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
}

function drawScene(ctx, W, H, rewind, pieces) {
	const g = rewind;
	const p = (nx, ny) => project(nx, ny, W, H);

	const ground = [p(0.16, 0.4), p(0.84, 0.4), p(0.97, 0.88), p(0.03, 0.88)];
	ctx.fillStyle = mixHex('#121212', '#4a3024', g);
	ctx.beginPath();
	ctx.moveTo(ground[0][0], ground[0][1]);
	for (let i = 1; i < 4; i++) ctx.lineTo(ground[i][0], ground[i][1]);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = mixHex('#333333', '#c4a07a', g);
	ctx.lineWidth = 1;
	ctx.stroke();

	ctx.strokeStyle = mixHex('#262626', '#7a5340', g);
	for (let i = 1; i <= 4; i++) {
		const t = i / 5;
		const [x0, y0] = [
			lerp(ground[0][0], ground[3][0], t),
			lerp(ground[0][1], ground[3][1], t),
		];
		const [x1, y1] = [
			lerp(ground[1][0], ground[2][0], t),
			lerp(ground[1][1], ground[2][1], t),
		];
		ctx.beginPath();
		ctx.moveTo(x0, y0);
		ctx.lineTo(x1, y1);
		ctx.stroke();
	}

	const [bx, by] = p(0.47, 0.66);
	const brx = Math.min(W, H) * 0.17;
	const bry = Math.min(W, H) * 0.072;

	ctx.fillStyle = mixHex('#0e0e0e', '#5a3228', g);
	ctx.beginPath();
	ctx.ellipse(bx, by, brx, bry, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = mixHex('#3a3a3a', '#b56a45', g);
	ctx.stroke();

	ctx.fillStyle = mixHex('#161616', '#4a5c3a', g);
	ctx.beginPath();
	ctx.ellipse(bx, by + 2, brx * 0.72, bry * 0.55, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = mixHex('#2a2a2a', '#6a7a52', g);
	ctx.stroke();

	const [px, py] = p(0.7, 0.58);
	drawPlinth(ctx, px, py, g);

	const fill = mixHex('#6a6a6a', '#7a6458', g * 0.4);
	const stroke = mixHex('#d4d4d4', '#e8d2c0', g * 0.45);
	const posed = pieces
		.map((piece) => {
			const pose = poseOf(piece, rewind);
			const [x, y] = p(pose.x, pose.y);
			return { ...pose, x, y };
		})
		.sort((a, b) => a.y - b.y);

	for (const pose of posed) drawPiece(ctx, pose, fill, stroke);
}

function palmCenter(landmarks) {
	let x = 0;
	let y = 0;
	for (const i of PALM) {
		x += landmarks[i].x;
		y += landmarks[i].y;
	}
	return { x: 1 - x / PALM.length, y: y / PALM.length };
}

let wasteLive = null;

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
			video: { facingMode: 'user' },
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

async function createLandmarker() {
	const { FilesetResolver, HandLandmarker } = await import(
		/* @vite-ignore */ `${TASKS}/vision_bundle.mjs`
	);
	const fileset = await FilesetResolver.forVisionTasks(`${TASKS}/wasm`);
	return HandLandmarker.createFromOptions(fileset, {
		baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
		runningMode: 'VIDEO',
		numHands: 1,
	});
}

export async function initWaste({ canvas, video, errorEl, hoarding }) {
	if (!canvas || !video) return;

	if (wasteLive?.raf) cancelAnimationFrame(wasteLive.raf);
	wasteLive?.abort?.abort();
	stopStream(wasteLive?.stream);
	const abort = new AbortController();
	wasteLive = { stream: null, raf: 0, abort };

	const pieces = buildPieces(hoarding);
	const ctx = canvas.getContext('2d');
	const dpr = window.devicePixelRatio || 1;
	let rewind = 0;
	let lastAngle = null;
	let cx = 0.5;
	let cy = 0.5;
	let centerReady = false;
	let landmarker = null;
	let lastVideoTime = -1;

	function sizeCanvas() {
		const w = window.innerWidth;
		const h = window.innerHeight;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function setGrade(t) {
		document.body.style.setProperty('--waste-grade', String(t));
	}

	function paint() {
		const w = window.innerWidth;
		const h = window.innerHeight;
		ctx.clearRect(0, 0, w, h);
		drawScene(ctx, w, h, rewind, pieces);
	}

	sizeCanvas();
	setGrade(rewind);
	paint();
	window.addEventListener('resize', () => {
		sizeCanvas();
		paint();
	});

	function onHands(landmarks) {
		const palm = palmCenter(landmarks);
		if (!centerReady) {
			cx = palm.x;
			cy = palm.y;
			centerReady = true;
			lastAngle = null;
			return;
		}
		cx += (palm.x - cx) * 0.08;
		cy += (palm.y - cy) * 0.08;
		const dx = palm.x - cx;
		const dy = palm.y - cy;
		const radius = Math.hypot(dx, dy);
		if (radius < 0.045) {
			lastAngle = null;
			return;
		}
		const angle = Math.atan2(dy, dx);
		if (lastAngle == null) {
			lastAngle = angle;
			return;
		}
		const delta = wrapAngle(angle - lastAngle);
		lastAngle = angle;
		if (Math.abs(delta) < 0.012 || Math.abs(delta) > 0.55) return;
		rewind = clamp(rewind - delta / (Math.PI * 2), 0, 1);
		setGrade(rewind);
	}

	function tick() {
		if (landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
			lastVideoTime = video.currentTime;
			try {
				const result = landmarker.detectForVideo(video, performance.now());
				if (result.landmarks?.[0]) onHands(result.landmarks[0]);
				else {
					lastAngle = null;
					centerReady = false;
				}
			} catch {
				lastVideoTime = -1;
			}
		}
		paint();
		wasteLive.raf = requestAnimationFrame(tick);
	}

	wasteLive.raf = requestAnimationFrame(tick);

	const stream = await startCamera(video, errorEl, abort.signal);
	wasteLive.stream = stream;

	if (import.meta.hot) {
		import.meta.hot.dispose(() => {
			wasteLive?.abort?.abort();
			if (wasteLive?.raf) cancelAnimationFrame(wasteLive.raf);
			stopStream(wasteLive?.stream);
			wasteLive = null;
		});
	}

	if (!stream) return;

	try {
		landmarker = await createLandmarker();
		await video.play().catch(() => {});
	} catch {
		landmarker = null;
	}
}
