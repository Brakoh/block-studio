import urbanSrc from '../../assets/sounds/urban.mp3?url';
import trafficSrc from '../../assets/sounds/traffic.mp3?url';
import sirenSrc from '../../assets/sounds/Siren.mp3?url';

function clamp(v, a, b) {
	return Math.max(a, Math.min(b, v));
}

function ramp(t, from, to) {
	if (t <= from) return 0;
	if (t >= to) return 1;
	return (t - from) / (to - from);
}

const MASTER_MIN = 0.3;
const MASTER_VOLUME = 1;

const LAYERS = [
	{ id: 'urban', src: urbanSrc, from: 0, to: 0.3, gain: 1 },
	{ id: 'traffic', src: trafficSrc, from: 0.4, to: 0.6, gain: 1 },
	{ id: 'siren', src: sirenSrc, from: 0.5, to: 1, gain: 4.8 },
];

export function initLoudnessAudio(density) {
	const AC = window.AudioContext || window.webkitAudioContext;
	const ctx = new AC();
	const masterGain = ctx.createGain();
	masterGain.gain.value = 0;
	masterGain.connect(ctx.destination);

	const layers = LAYERS.map((spec) => {
		const el = new Audio(spec.src);
		el.loop = true;
		el.preload = 'auto';
		el.playsInline = true;
		el.volume = 1;
		el.controls = false;
		el.crossOrigin = 'anonymous';
		el.setAttribute('playsinline', '');
		el.setAttribute('webkit-playsinline', '');
		el.setAttribute('aria-hidden', 'true');
		el.style.display = 'none';
		el.setAttribute('data-loudness-layer', spec.id);
		document.body.appendChild(el);

		const srcNode = ctx.createMediaElementSource(el);
		const gainNode = ctx.createGain();
		gainNode.gain.value = 0;
		srcNode.connect(gainNode).connect(masterGain);

		return { ...spec, el, gainNode };
	});

	let unlocked = false;

	function sliderT() {
		return density ? clamp(Number(density.value) / 100, 0, 1) : 0;
	}

	function startLayers() {
		for (const layer of layers) {
			if (layer.el.paused) layer.el.play().catch(() => {});
		}
	}

	function apply() {
		const t = sliderT();
		const audible = !document.hidden;
		const master = MASTER_MIN + t * (MASTER_VOLUME - MASTER_MIN);
		density?.setAttribute('data-master', String(master));
		masterGain.gain.setTargetAtTime(audible ? master : 0, ctx.currentTime, 0.03);

		for (const layer of layers) {
			const mix = ramp(t, layer.from, layer.to) * layer.gain;
			layer.el.dataset.mix = String(mix);
			layer.gainNode.gain.setTargetAtTime(mix, ctx.currentTime, 0.03);
		}

		if (unlocked && audible) startLayers();
		else {
			for (const layer of layers) {
				if (!layer.el.paused) layer.el.pause();
			}
		}
	}

	function unlock() {
		if (ctx.state === 'suspended') ctx.resume().catch(() => {});
		unlocked = true;
		startLayers();
		apply();
	}

	const unlockOpts = { capture: true, passive: true };
	density?.addEventListener('pointerdown', unlock, unlockOpts);
	density?.addEventListener('touchstart', unlock, unlockOpts);
	density?.addEventListener('input', unlock);
	density?.addEventListener('change', unlock);
	window.addEventListener('pointerdown', unlock, unlockOpts);
	window.addEventListener('touchstart', unlock, unlockOpts);
	window.addEventListener('keydown', unlock);
	document.addEventListener('visibilitychange', apply);
	apply();

	return () => {
		density?.removeEventListener('pointerdown', unlock, unlockOpts);
		density?.removeEventListener('touchstart', unlock, unlockOpts);
		density?.removeEventListener('input', unlock);
		density?.removeEventListener('change', unlock);
		window.removeEventListener('pointerdown', unlock, unlockOpts);
		window.removeEventListener('touchstart', unlock, unlockOpts);
		window.removeEventListener('keydown', unlock);
		document.removeEventListener('visibilitychange', apply);
		ctx.close().catch(() => {});
		for (const layer of layers) {
			layer.el.pause();
			layer.el.removeAttribute('src');
			layer.el.load();
			layer.el.remove();
		}
	};
}
