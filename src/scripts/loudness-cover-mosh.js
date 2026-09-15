import * as THREE from 'three';
import { createLoudnessMosh } from './loudness-mosh.js';

const IDLE = 0.16;
const PEAK = 1;
const BURST_MS = 320;
const PEAK_HOLD_MS = 90;

function loadSvgImage(svg) {
	const clone = svg.cloneNode(true);
	if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	clone.querySelectorAll('path').forEach((p) => p.setAttribute('fill', '#ffffff'));
	const xml = new XMLSerializer().serializeToString(clone);
	const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject();
		};
		img.src = url;
	});
}

function paintLockup(ctx, cover, img, cssW, cssH) {
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, cssW, cssH);

	const origin = cover.getBoundingClientRect();
	const icon = cover.querySelector('.loudness-cover-icon');
	const copy = cover.querySelector('.loudness-cover-copy');
	if (!icon || !copy) return;

	const iconBox = icon.getBoundingClientRect();
	ctx.drawImage(
		img,
		iconBox.left - origin.left,
		iconBox.top - origin.top,
		iconBox.width,
		iconBox.height,
	);

	const copyBox = copy.getBoundingClientRect();
	const cs = getComputedStyle(copy);
	ctx.fillStyle = '#fff';
	ctx.font = cs.font;
	ctx.letterSpacing = cs.letterSpacing;
	ctx.textBaseline = 'top';
	ctx.textAlign = 'left';
	ctx.fillText(copy.textContent || '', copyBox.left - origin.left, copyBox.top - origin.top);
}

function api({ stop = () => {}, burst = (onPeak) => onPeak?.() } = {}) {
	return { stop, burst };
}

export function initCoverMosh(cover) {
	if (!cover) return api();
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return api();

	const svg = cover.querySelector('.loudness-cover-icon svg');
	const lockup = cover.querySelector('.loudness-cover-lockup');
	if (!svg || !lockup) return api();

	let stopped = false;
	let raf = 0;
	let renderer;
	let mosh;
	let texture;
	let scene;
	let camera;
	let quad;
	let img;
	let amount = IDLE;
	let burstT0 = 0;
	let burstOnPeak = null;
	let burstFired = false;
	let queuedBurst = null;

	const src = document.createElement('canvas');
	const srcCtx = src.getContext('2d');
	if (!srcCtx) return api();

	const canvas = document.createElement('canvas');
	canvas.className = 'loudness-cover-mosh';
	canvas.setAttribute('aria-hidden', 'true');
	cover.appendChild(canvas);

	function sizeSource() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const w = Math.max(1, cover.clientWidth);
		const h = Math.max(1, cover.clientHeight);
		src.width = Math.max(1, Math.floor(w * dpr));
		src.height = Math.max(1, Math.floor(h * dpr));
		srcCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
		return { w, h, dpr };
	}

	function stop() {
		if (stopped) return;
		stopped = true;
		cancelAnimationFrame(raf);
		window.removeEventListener('resize', onResize);
		mosh?.dispose();
		texture?.dispose();
		quad?.geometry.dispose();
		quad?.material.dispose();
		renderer?.dispose();
		canvas.remove();
		lockup.classList.remove('is-moshed');
	}

	function firePeak() {
		if (burstFired) return;
		burstFired = true;
		const cb = burstOnPeak;
		burstOnPeak = null;
		cb?.();
	}

	function burst(onPeak) {
		if (stopped) {
			onPeak?.();
			return;
		}
		burstOnPeak = onPeak;
		if (!mosh) {
			queuedBurst = true;
			return;
		}
		burstT0 = performance.now();
	}

	function onResize() {
		if (stopped || !renderer || !img) return;
		const { w, h, dpr } = sizeSource();
		renderer.setPixelRatio(dpr);
		renderer.setSize(w, h, false);
		paintLockup(srcCtx, cover, img, w, h);
		texture.needsUpdate = true;
		mosh.resize();
	}

	loadSvgImage(svg)
		.then((loaded) => document.fonts.ready.then(() => loaded))
		.then((loaded) => {
			if (stopped) return;
			img = loaded;
			const { w, h, dpr } = sizeSource();
			paintLockup(srcCtx, cover, img, w, h);

			renderer = new THREE.WebGLRenderer({
				canvas,
				antialias: false,
				alpha: false,
				powerPreference: 'low-power',
			});
			renderer.setClearColor(0x000000, 1);
			renderer.setPixelRatio(dpr);
			renderer.setSize(w, h, false);
			renderer.outputColorSpace = THREE.SRGBColorSpace;

			texture = new THREE.CanvasTexture(src);
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.minFilter = THREE.NearestFilter;
			texture.magFilter = THREE.NearestFilter;
			texture.generateMipmaps = false;

			const mat = new THREE.MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false });
			quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
			scene = new THREE.Scene();
			scene.add(quad);
			camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

			mosh = createLoudnessMosh(renderer);
			window.addEventListener('resize', onResize);

			const t0 = performance.now();
			let shown = false;
			function frame(now) {
				if (stopped) return;
				raf = requestAnimationFrame(frame);
				if (burstT0) {
					const u = (now - burstT0) / BURST_MS;
					const k = Math.min(1, Math.max(0, u));
					amount = IDLE + (PEAK - IDLE) * (k * k);
					if (now - burstT0 >= BURST_MS + PEAK_HOLD_MS) firePeak();
				}
				mosh.render(scene, camera, amount, (now - t0) * 0.001);
				if (!shown) {
					lockup.classList.add('is-moshed');
					shown = true;
				}
			}
			raf = requestAnimationFrame(frame);
			if (queuedBurst) burst(burstOnPeak);
		})
		.catch(() => {
			canvas.remove();
			if (burstOnPeak) firePeak();
		});

	return api({ stop, burst });
}
