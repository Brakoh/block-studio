import * as THREE from 'three';
import { initLoudnessAudio } from './loudness-audio.js';
import { createLoudnessMosh } from './loudness-mosh.js';

const CITY = 2200;
const HALF = CITY * 0.5;
const GRID = 2800;

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

function hash2(x, y) {
	return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
}

function fract(v) {
	return v - Math.floor(v);
}

class Cloud {
	constructor(max) {
		this.pos = new Float32Array(max * 3);
		this.col = new Float32Array(max * 3);
		this.seed = new Float32Array(max);
		this.n = 0;
		this.max = max;
	}

	get left() {
		return this.max - this.n;
	}

	add(x, y, z, lum, rng) {
		if (this.n >= this.max) return;
		const i = this.n * 3;
		this.pos[i] = x;
		this.pos[i + 1] = y;
		this.pos[i + 2] = z;
		this.col[i] = lum;
		this.col[i + 1] = lum;
		this.col[i + 2] = lum;
		this.seed[this.n] = rng();
		this.n++;
	}

	geometry() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(this.pos.subarray(0, this.n * 3), 3));
		g.setAttribute('color', new THREE.BufferAttribute(this.col.subarray(0, this.n * 3), 3));
		g.setAttribute('aSeed', new THREE.BufferAttribute(this.seed.subarray(0, this.n), 1));
		return g;
	}
}

class Strokes {
	constructor(maxSeg) {
		this.pos = new Float32Array(maxSeg * 6);
		this.col = new Float32Array(maxSeg * 6);
		this.n = 0;
		this.max = maxSeg;
	}

	get left() {
		return this.max - this.n;
	}

	add(ax, ay, az, bx, by, bz, lum) {
		if (this.n >= this.max) return;
		const i = this.n * 6;
		this.pos[i] = ax;
		this.pos[i + 1] = ay;
		this.pos[i + 2] = az;
		this.pos[i + 3] = bx;
		this.pos[i + 4] = by;
		this.pos[i + 5] = bz;
		const a = lum * 0.85;
		const b = lum;
		this.col[i] = a;
		this.col[i + 1] = a;
		this.col[i + 2] = a;
		this.col[i + 3] = b;
		this.col[i + 4] = b;
		this.col[i + 5] = b;
		this.n++;
	}

	geometry() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(this.pos.subarray(0, this.n * 6), 3));
		g.setAttribute('color', new THREE.BufferAttribute(this.col.subarray(0, this.n * 6), 3));
		return g;
	}
}

function irregularCuts(rng, lo, hi, core) {
	const out = [lo];
	let x = lo;
	while (x < hi - 14) {
		const downtown = Math.abs(x) < core;
		const gap = downtown ? 18 + rng() * 26 : 28 + rng() * 52;
		x += gap;
		if (x < hi - 10) out.push(x);
	}
	out.push(hi);
	return out;
}

function riverX(z) {
	return 480 + Math.sin(z * 0.0068) * 70 + Math.sin(z * 0.019) * 18;
}

function inRiver(x, z, width = 18) {
	return Math.abs(x - riverX(z)) < width;
}

function distCore(x, z) {
	return Math.hypot(x, z);
}

function pickNext(node, fromId, incoming, directed, rng) {
	const opts = node.out.filter((id) => id !== fromId);
	if (!opts.length) return node.out[0] ?? fromId;
	if (rng() < 0.18 || !incoming) return opts[(rng() * opts.length) | 0];
	const ix = incoming.x1 - incoming.x0;
	const iz = incoming.z1 - incoming.z0;
	let best = opts[0];
	let score = -Infinity;
	for (const id of opts) {
		const e = directed[id];
		const dot = ix * (e.x1 - e.x0) + iz * (e.z1 - e.z0);
		const n = dot / (incoming.len * e.len + 0.001) + rng() * 0.15;
		if (n > score) {
			score = n;
			best = id;
		}
	}
	return best;
}

function scanWall(cloud, strokes, ax, az, bx, bz, y0, y1, rng, density) {
	const dx = bx - ax;
	const dz = bz - az;
	const len = Math.hypot(dx, dz);
	if (len < 2 || y1 - y0 < 4) return;
	const ux = dx / len;
	const uz = dz / len;
	const nx = -uz;
	const nz = ux;
	const ring = density > 0.72 ? 0.48 : density > 0.4 ? 0.7 : 1.15;
	const along = density > 0.72 ? 0.28 : density > 0.4 ? 0.42 : 0.72;
	const hole = 0.08 + (1 - density) * 0.16;

	for (let y = y0 + 0.35; y < y1 - 0.15; y += ring * (0.65 + rng() * 0.7)) {
		const gy = (y * 1.7) | 0;
		for (let s = 0; s < len; s += along * (0.55 + rng() * 0.85)) {
			const t = s / len;
			const gx = ((ax + dx * t) * 0.35) | 0;
			if (hash2(gx, gy) < hole || rng() < 0.08) continue;
			if (cloud.left < 2) return;
			const inset = rng() < 0.07 ? rng() * 0.55 : (rng() - 0.5) * 0.06;
			const lum = 0.42 + rng() * 0.58;
			cloud.add(
				ax + dx * t + nx * inset + (rng() - 0.5) * 0.1,
				y + (rng() - 0.5) * 0.08,
				az + dz * t + nz * inset + (rng() - 0.5) * 0.1,
				lum,
				rng,
			);
		}
	}

	const floors = Math.max(1, Math.floor((y1 - y0) / 3.25));
	const bays = Math.max(2, Math.floor(len / 3.4));
	for (let f = 1; f < floors; f++) {
		const wy = y0 + f * 3.25 + 0.7;
		for (let b = 0; b < bays; b++) {
			if (rng() < 0.2) continue;
			const t = (b + 0.42 + rng() * 0.16) / bays;
			const wx = ax + dx * t;
			const wz = az + dz * t;
			const lit = rng() > 0.74;
			const nPts = lit ? 7 + ((rng() * 5) | 0) : 3 + ((rng() * 3) | 0);
			for (let k = 0; k < nPts; k++) {
				if (cloud.left < 1) return;
				cloud.add(
					wx + (rng() - 0.5) * 1.05 * ux + nx * rng() * 0.1,
					wy + (rng() - 0.5) * 1.35,
					wz + (rng() - 0.5) * 1.05 * uz + nz * rng() * 0.1,
					lit ? 0.82 + rng() * 0.18 : 0.38 + rng() * 0.28,
					rng,
				);
			}
			if (rng() > 0.48 && strokes.left > 0) {
				const sl = 0.35 + rng() * 0.85;
				strokes.add(
					wx - ux * sl,
					wy - 0.72,
					wz - uz * sl,
					wx + ux * sl,
					wy - 0.72,
					wz + uz * sl,
					0.55 + rng() * 0.25,
				);
			}
			if (rng() > 0.82 && strokes.left > 0) {
				const vh = 0.4 + rng() * 0.9;
				strokes.add(wx, wy - vh, wz, wx, wy + vh, wz, 0.5);
			}
		}
	}

	for (const [ex, ez] of [
		[ax, az],
		[bx, bz],
	]) {
		let y = y0;
		while (y < y1 - 0.8 && strokes.left > 0) {
			const h = 0.9 + rng() * 3.6;
			if (rng() > 0.58) {
				strokes.add(ex, y, ez, ex, Math.min(y1, y + h), ez, 0.4 + rng() * 0.35);
			}
			y += h + 0.8 + rng() * 3.2;
		}
	}

	if (density > 0.55) {
		for (let i = 0; i < 6 + density * 10; i++) {
			if (strokes.left < 1) break;
			const t = rng();
			const y = y0 + rng() * (y1 - y0);
			const sl = 0.25 + rng() * 1.1;
			const px = ax + dx * t;
			const pz = az + dz * t;
			strokes.add(px, y, pz, px + ux * sl, y + (rng() - 0.5) * 0.2, pz + uz * sl, 0.35 + rng() * 0.3);
		}
	}
}

function scanRoof(cloud, strokes, x0, z0, x1, z1, y, rng, density) {
	const w = x1 - x0;
	const d = z1 - z0;
	const step = density > 0.7 ? 0.55 : 0.95;
	for (let x = x0 + 0.4; x < x1 - 0.4; x += step * (0.6 + rng() * 0.7)) {
		for (let z = z0 + 0.4; z < z1 - 0.4; z += step * (0.6 + rng() * 0.7)) {
			if (rng() < 0.22) continue;
			if (cloud.left < 1) return;
			cloud.add(x + (rng() - 0.5) * 0.12, y + rng() * 0.08, z + (rng() - 0.5) * 0.12, 0.35 + rng() * 0.4, rng);
		}
	}
	if (rng() > 0.55 && w > 8 && d > 8) {
		const cx = (x0 + x1) * 0.5;
		const cz = (z0 + z1) * 0.5;
		const hw = 1.4 + rng() * 2.2;
		const hd = 1.2 + rng() * 1.8;
		const hh = 1.5 + rng() * 3.5;
		scanWall(cloud, strokes, cx - hw, cz - hd, cx + hw, cz - hd, y, y + hh, rng, density * 0.8);
		scanWall(cloud, strokes, cx + hw, cz - hd, cx + hw, cz + hd, y, y + hh, rng, density * 0.8);
		scanWall(cloud, strokes, cx + hw, cz + hd, cx - hw, cz + hd, y, y + hh, rng, density * 0.8);
		scanWall(cloud, strokes, cx - hw, cz + hd, cx - hw, cz - hd, y, y + hh, rng, density * 0.8);
	}
}

function scanBuilding(cloud, strokes, b, rng) {
	const { x0, z0, x1, z1, h, podium } = b;
	const cx = (x0 + x1) * 0.5;
	const cz = (z0 + z1) * 0.5;
	const downtown = clamp(1 - distCore(cx, cz) / 560, 0, 1);
	const density = 0.28 + downtown * 0.72;
	const pointCap =
		h > 140 ? 8000 : h > 80 ? 4500 : h > 40 ? 2200 : h > 22 ? 1100 : 480;
	const strokeCap = h > 80 ? 220 : h > 40 ? 120 : 60;
	const startP = cloud.n;
	const startS = strokes.n;
	const pts = {
		get left() {
			return Math.min(cloud.left, pointCap - (cloud.n - startP));
		},
		add(x, y, z, lum, r) {
			if (this.left < 1) return;
			cloud.add(x, y, z, lum, r);
		},
	};
	const segs = {
		get left() {
			return Math.min(strokes.left, strokeCap - (strokes.n - startS));
		},
		add(ax, ay, az, bx, by, bz, lum) {
			if (this.left < 1) return;
			strokes.add(ax, ay, az, bx, by, bz, lum);
		},
	};

	const walls = [
		[x0, z0, x1, z0],
		[x1, z0, x1, z1],
		[x1, z1, x0, z1],
		[x0, z1, x0, z0],
	];

	if (podium && h > 48) {
		const ph = 10 + rng() * 8;
		for (const w of walls) scanWall(pts, segs, w[0], w[1], w[2], w[3], 0, ph, rng, density);
		const inset = 2.2 + rng() * 2.4;
		const tx0 = x0 + inset;
		const tz0 = z0 + inset;
		const tx1 = x1 - inset;
		const tz1 = z1 - inset;
		if (tx1 - tx0 > 6 && tz1 - tz0 > 6) {
			const tw = [
				[tx0, tz0, tx1, tz0],
				[tx1, tz0, tx1, tz1],
				[tx1, tz1, tx0, tz1],
				[tx0, tz1, tx0, tz0],
			];
			for (const w of tw) scanWall(pts, segs, w[0], w[1], w[2], w[3], ph, h, rng, density);
			scanRoof(pts, segs, tx0, tz0, tx1, tz1, h, rng, density);
			scanRoof(pts, segs, x0, z0, x1, z1, ph, rng, density * 0.6);
		} else {
			scanRoof(pts, segs, x0, z0, x1, z1, h, rng, density);
		}
	} else {
		for (const w of walls) scanWall(pts, segs, w[0], w[1], w[2], w[3], 0, h, rng, density);
		scanRoof(pts, segs, x0, z0, x1, z1, h, rng, density);
	}

	if (density > 0.5 && rng() > 0.4) {
		const floors = Math.floor(h / 3.25);
		for (let f = 2; f < floors; f += 1 + ((rng() * 2) | 0)) {
			if (segs.left < 4) break;
			const y = f * 3.25;
			const t0 = 0.08 + rng() * 0.2;
			const t1 = t0 + 0.15 + rng() * 0.35;
			segs.add(x0 + (x1 - x0) * t0, y, z0, x0 + (x1 - x0) * t1, y, z0, 0.32 + rng() * 0.2);
		}
	}
}

function packBlock(x0, z0, x1, z1, rng, buildings) {
	const w = x1 - x0;
	const d = z1 - z0;
	if (w < 9 || d < 9) return;
	const cx = (x0 + x1) * 0.5;
	const cz = (z0 + z1) * 0.5;
	if (inRiver(cx, cz, 26)) return;

	if (w > 30 && d > 16 && rng() < 0.72) {
		const split = x0 + 9 + rng() * (w - 18);
		const alley = 1.8 + rng() * 2.4;
		packBlock(x0, z0, split - alley * 0.5, z1, rng, buildings);
		packBlock(split + alley * 0.5, z0, x1, z1, rng, buildings);
		return;
	}
	if (d > 30 && w > 16 && rng() < 0.6) {
		const split = z0 + 9 + rng() * (d - 18);
		const alley = 1.8 + rng() * 2.4;
		packBlock(x0, z0, x1, split - alley * 0.5, rng, buildings);
		packBlock(x0, split + alley * 0.5, x1, z1, rng, buildings);
		return;
	}

	const downtown = clamp(1 - distCore(cx, cz) / 640, 0, 1);
	let h = 14 + rng() * 18 + downtown * (18 + rng() * 58);
	if (downtown > 0.58 && rng() < 0.09) h += 32 + rng() * 72;
	if (downtown < 0.1) h = Math.min(h, 28 + rng() * 10);

	buildings.push({
		x0,
		z0,
		x1,
		z1,
		h,
		podium: downtown > 0.42 && h > 52 && rng() < 0.5,
	});
}

function buildCity(rng, budgets) {
	const xs = irregularCuts(rng, -HALF, HALF, 230);
	const zs = irregularCuts(rng, -HALF, HALF, 230);
	const parks = new Set();
	for (let k = 0; k < 3; k++) {
		parks.add(`${3 + ((rng() * (xs.length - 6)) | 0)},${3 + ((rng() * (zs.length - 6)) | 0)}`);
	}

	const nodes = [];
	const at = new Map();
	for (let i = 0; i < xs.length; i++) {
		for (let j = 0; j < zs.length; j++) {
			if (inRiver(xs[i], zs[j], 22) && Math.abs(xs[i] - riverX(zs[j])) > 4) continue;
			at.set(`${i},${j}`, nodes.length);
			nodes.push({ x: xs[i], z: zs[j], out: [] });
		}
	}

	const directed = [];
	function link(i0, j0, i1, j1) {
		const a = at.get(`${i0},${j0}`);
		const b = at.get(`${i1},${j1}`);
		if (a == null || b == null) return;
		if (rng() < 0.05) return;
		const na = nodes[a];
		const nb = nodes[b];
		const len = Math.hypot(nb.x - na.x, nb.z - na.z);
		if (len < 8) return;
		const idAb = directed.length;
		directed.push({ a, b, x0: na.x, z0: na.z, x1: nb.x, z1: nb.z, len });
		const idBa = directed.length;
		directed.push({ a: b, b: a, x0: nb.x, z0: nb.z, x1: na.x, z1: na.z, len });
		na.out.push(idAb);
		nb.out.push(idBa);
	}

	for (let i = 0; i < xs.length; i++) {
		for (let j = 0; j < zs.length; j++) {
			if (i + 1 < xs.length) link(i, j, i + 1, j);
			if (j + 1 < zs.length) link(i, j, i, j + 1);
		}
	}

	for (let k = 0; k < 14; k++) {
		const i = (rng() * (xs.length - 3)) | 0;
		const j = (rng() * (zs.length - 3)) | 0;
		link(i, j, i + 2, j + 1);
	}

	const buildings = [];
	for (let i = 0; i < xs.length - 1; i++) {
		for (let j = 0; j < zs.length - 1; j++) {
			if (parks.has(`${i},${j}`)) continue;
			const x0 = xs[i];
			const x1 = xs[i + 1];
			const z0 = zs[j];
			const z1 = zs[j + 1];
			if (x1 - x0 < 16 || z1 - z0 < 16) continue;
			const cx = (x0 + x1) * 0.5;
			const cz = (z0 + z1) * 0.5;
			if (inRiver(cx, cz, 34)) continue;
			const inset = 3.2 + rng() * 1.8;
			packBlock(x0 + inset, z0 + inset, x1 - inset, z1 - inset, rng, buildings);
		}
	}

	const cloud = new Cloud(budgets.points);
	const strokes = new Strokes(budgets.strokes);

	const undirected = [];
	for (let i = 0; i < directed.length; i += 2) undirected.push(directed[i]);

	for (const e of undirected) {
		const dx = e.x1 - e.x0;
		const dz = e.z1 - e.z0;
		const inv = 1 / e.len;
		const ux = dx * inv;
		const uz = dz * inv;
		const nx = -uz;
		const nz = ux;
		const isBridge = inRiver((e.x0 + e.x1) * 0.5, (e.z0 + e.z1) * 0.5, 22);
		const yRoad = isBridge ? 7.2 : 0.04;
		const step = 1.35;
		for (let s = 0; s < e.len; s += step * (0.55 + rng() * 0.55)) {
			const t = s / e.len;
			const x = e.x0 + dx * t;
			const z = e.z0 + dz * t;
			if (cloud.left < 6) break;
			cloud.add(x + (rng() - 0.5) * 0.25, yRoad, z + (rng() - 0.5) * 0.25, 0.5 + rng() * 0.35, rng);
			if (rng() > 0.28) {
				cloud.add(x + nx * 3.1 + (rng() - 0.5) * 0.45, 0.06, z + nz * 3.1, 0.28 + rng() * 0.22, rng);
				cloud.add(x - nx * 3.1 + (rng() - 0.5) * 0.45, 0.06, z - nz * 3.1, 0.28 + rng() * 0.22, rng);
			}
			if (rng() > 0.4) {
				cloud.add(x + nx * (1.4 + rng() * 1.2), 0.05, z + nz * (1.4 + rng() * 1.2), 0.4 + rng() * 0.22, rng);
			}
		}
		let s = 0;
		while (s < e.len && strokes.left > 3) {
			const run = 0.8 + rng() * 3.4;
			const gap = 0.5 + rng() * 2.8;
			if (rng() > 0.3) {
				const t0 = s / e.len;
				const t1 = Math.min(1, (s + run) / e.len);
				strokes.add(
					e.x0 + dx * t0,
					yRoad,
					e.z0 + dz * t0,
					e.x0 + dx * t1,
					yRoad,
					e.z0 + dz * t1,
					0.28 + rng() * 0.18,
				);
			}
			if (rng() > 0.55) {
				const t0 = s / e.len;
				const t1 = Math.min(1, (s + run * 0.6) / e.len);
				strokes.add(
					e.x0 + dx * t0 + nx * 4.1,
					0.02,
					e.z0 + dz * t0 + nz * 4.1,
					e.x0 + dx * t1 + nx * 4.1,
					0.02,
					e.z0 + dz * t1 + nz * 4.1,
					0.16 + rng() * 0.12,
				);
			}
			s += run + gap;
		}
		if (isBridge && strokes.left > 6) {
			for (let p = 0.15; p < 0.9; p += 0.22) {
				const x = e.x0 + dx * p;
				const z = e.z0 + dz * p;
				strokes.add(x, 0, z, x, 7.15, z, 0.3);
			}
		}
		for (let s = 8; s < e.len - 8; s += 18 + rng() * 10) {
			if (strokes.left < 2) break;
			const t = s / e.len;
			const x = e.x0 + dx * t;
			const z = e.z0 + dz * t;
			strokes.add(x - ux * 1.1, 0.04, z - uz * 1.1, x + ux * 1.1, 0.04, z + uz * 1.1, 0.5);
		}
	}

	for (let i = 0; i < xs.length; i++) {
		for (let j = 0; j < zs.length; j++) {
			if (at.get(`${i},${j}`) == null) continue;
			const x = xs[i];
			const z = zs[j];
			if (inRiver(x, z, 24)) continue;
			for (let k = 0; k < 10; k++) {
				if (cloud.left < 1) break;
				const a = rng() * Math.PI * 2;
				const r = rng() * 6.5;
				cloud.add(x + Math.cos(a) * r, 0.05, z + Math.sin(a) * r, 0.45 + rng() * 0.35, rng);
			}
		}
	}

	buildings.sort((a, b) => {
		const da = distCore((a.x0 + a.x1) * 0.5, (a.z0 + a.z1) * 0.5);
		const db = distCore((b.x0 + b.x1) * 0.5, (b.z0 + b.z1) * 0.5);
		return da - db;
	});
	const kept = [];
	for (const b of buildings) {
		const d = distCore((b.x0 + b.x1) * 0.5, (b.z0 + b.z1) * 0.5);
		if (d < 520 || rng() < (d < 900 ? 0.55 : 0.22)) kept.push(b);
	}
	for (const b of kept) scanBuilding(cloud, strokes, b, rng);

	return { cloud, strokes, directed, nodes };
}

function buildGrid() {
	const segs = [];
	const push = (ax, az, bx, bz, lum) => {
		segs.push(ax, -0.8, az, lum, lum * 0.15, lum * 0.15, bx, -0.8, bz, lum, lum * 0.15, lum * 0.15);
	};
	const ext = GRID * 0.5;
	for (let x = -ext; x <= ext; x += 80) push(x, -ext, x, ext, 0.16);
	for (let z = -ext; z <= ext; z += 80) push(-ext, z, ext, z, 0.16);
	for (let x = -ext; x <= ext; x += 20) {
		if (x % 80 === 0) continue;
		push(x, -ext, x, ext, 0.07);
	}
	for (let z = -ext; z <= ext; z += 20) {
		if (z % 80 === 0) continue;
		push(-ext, z, ext, z, 0.07);
	}
	const pos = new Float32Array((segs.length / 6) * 3);
	const col = new Float32Array(pos.length);
	for (let i = 0, p = 0, c = 0; i < segs.length; i += 6) {
		pos[p++] = segs[i];
		pos[p++] = segs[i + 1];
		pos[p++] = segs[i + 2];
		col[c++] = segs[i + 3];
		col[c++] = segs[i + 4];
		col[c++] = segs[i + 5];
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	g.setAttribute('color', new THREE.BufferAttribute(col, 3));
	return g;
}

const POINT_VERT = `
attribute float aSeed;
attribute vec3 color;
uniform float uTime;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
	vColor = color;
	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
	float dist = max(1.0, -mvPosition.z);
	float flicker = 0.88 + 0.12 * sin(uTime * (1.05 + aSeed * 0.7) + aSeed * 14.0);
	float nearBoost = smoothstep(520.0, 55.0, dist);
	float keep = fract(sin(aSeed * 917.13) * 43758.5453);
	float farDrop = smoothstep(380.0, 1500.0, dist) * 0.42;
	vAlpha = flicker * mix(0.62, 1.0, nearBoost);
	if (keep < farDrop) {
		gl_PointSize = 0.0;
		gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
		vAlpha = 0.0;
		return;
	}
	gl_PointSize = uScale * flicker * (1.05 + nearBoost * 0.7) * (260.0 / dist);
	gl_PointSize = clamp(gl_PointSize, 0.75, 3.4);
	gl_Position = projectionMatrix * mvPosition;
}
`;

const POINT_FRAG = `
varying vec3 vColor;
varying float vAlpha;
void main() {
	vec2 p = gl_PointCoord - vec2(0.5);
	if (dot(p, p) > 0.22) discard;
	gl_FragColor = vec4(vColor, vAlpha);
}
`;

function pointMaterial(vertexShader, size) {
	return new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uScale: { value: size },
		},
		vertexShader,
		fragmentShader: POINT_FRAG,
		transparent: true,
		depthWrite: false,
		depthTest: true,
		blending: THREE.NormalBlending,
	});
}

export function initLoudness({ canvas, density }) {
	const stopAudio = initLoudnessAudio(density);
	const mobile = window.matchMedia('(max-width: 768px)').matches;
	const budgets = mobile
		? { points: 320000, strokes: 36000, vehicles: 500, trails: 16 }
		: { points: 1250000, strokes: 100000, vehicles: 5000, trails: 20 };

	const rng = mulberry32(0x51e30d);
	const city = buildCity(rng, budgets);

	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: true,
		powerPreference: 'high-performance',
		alpha: false,
	});
	renderer.setClearColor(0x000000, 1);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.6));
	renderer.setSize(window.innerWidth, window.innerHeight, false);

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x000000);

	const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1.2, 2800);

	const cityMat = pointMaterial(POINT_VERT, mobile ? 1.35 : 1.55);
	const cityPts = new THREE.Points(city.cloud.geometry(), cityMat);
	scene.add(cityPts);

	const lineMat = new THREE.LineBasicMaterial({
		vertexColors: true,
		transparent: true,
		opacity: 0.34,
		depthWrite: false,
	});
	scene.add(new THREE.LineSegments(city.strokes.geometry(), lineMat));

	const gridMat = new THREE.LineBasicMaterial({
		vertexColors: true,
		transparent: true,
		opacity: 0.38,
		depthWrite: false,
	});
	scene.add(new THREE.LineSegments(buildGrid(), gridMat));

	const nVeh = budgets.vehicles;
	const trailLen = budgets.trails;
	const dummy = new THREE.Object3D();
	const CAR_LEN = 9.4;
	const CAR_WID = 3.1;
	const CAR_HT = 0.85;
	const vehicles = [];
	for (let i = 0; i < nVeh; i++) {
		const edge = (rng() * city.directed.length) | 0;
		const speed = (11 + rng() * 17) * (rng() < 0.16 ? 0.55 : 1);
		vehicles.push({
			edge,
			t: rng(),
			speed,
			lane: (rng() < 0.5 ? -1 : 1) * (1.5 + rng() * 0.85),
		});
	}

	const carGeo = new THREE.BoxGeometry(1, 1, 1);
	const carMat = new THREE.MeshBasicMaterial({
		color: 0xffffff,
		depthWrite: true,
	});
	const cars = new THREE.InstancedMesh(carGeo, carMat, nVeh);
	cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	cars.frustumCulled = false;
	scene.add(cars);

	const trailSegs = trailLen - 1;
	const trailPos = new Float32Array(nVeh * trailSegs * 6);
	const trailCol = new Float32Array(nVeh * trailSegs * 6);
	const trailHist = vehicles.map(() => Array.from({ length: trailLen }, () => [0, 0.55, 0]));
	const trailGeo = new THREE.BufferGeometry();
	trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3).setUsage(THREE.DynamicDrawUsage));
	trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3).setUsage(THREE.DynamicDrawUsage));
	const trailMat = new THREE.LineBasicMaterial({
		vertexColors: true,
		transparent: true,
		opacity: 0.42,
		depthWrite: false,
	});
	const trails = new THREE.LineSegments(trailGeo, trailMat);
	trails.frustumCulled = false;
	scene.add(trails);

	function placeVehicle(v, i) {
		const e = city.directed[v.edge];
		if (!e) return;
		const x = e.x0 + (e.x1 - e.x0) * v.t;
		const z = e.z0 + (e.z1 - e.z0) * v.t;
		const ux = (e.x1 - e.x0) / e.len;
		const uz = (e.z1 - e.z0) / e.len;
		const nx = -uz;
		const nz = ux;
		const y = inRiver(x, z, 36) ? 7.45 : 0.62;
		const px = x + nx * v.lane;
		const pz = z + nz * v.lane;

		dummy.position.set(px, y + CAR_HT * 0.5, pz);
		dummy.scale.set(CAR_WID, CAR_HT, CAR_LEN);
		dummy.rotation.set(0, Math.atan2(ux, uz), 0);
		dummy.updateMatrix();
		cars.setMatrixAt(i, dummy.matrix);

		const hist = trailHist[i];
		for (let k = trailLen - 1; k > 0; k--) {
			hist[k][0] = hist[k - 1][0];
			hist[k][1] = hist[k - 1][1];
			hist[k][2] = hist[k - 1][2];
		}
		hist[0][0] = px - ux * (CAR_LEN * 0.45);
		hist[0][1] = y + 0.12;
		hist[0][2] = pz - uz * (CAR_LEN * 0.45);

		const base = i * trailSegs * 6;
		for (let k = 0; k < trailSegs; k++) {
			const ti = base + k * 6;
			const a = hist[k];
			const b = hist[k + 1];
			trailPos[ti] = a[0];
			trailPos[ti + 1] = a[1];
			trailPos[ti + 2] = a[2];
			trailPos[ti + 3] = b[0];
			trailPos[ti + 4] = b[1];
			trailPos[ti + 5] = b[2];
			const fadeA = 0.7 * (1 - k / trailLen);
			const fadeB = 0.7 * (1 - (k + 1) / trailLen);
			trailCol[ti] = trailCol[ti + 1] = trailCol[ti + 2] = fadeA;
			trailCol[ti + 3] = trailCol[ti + 4] = trailCol[ti + 5] = fadeB;
		}
	}

	function sliderT() {
		return density ? clamp(Number(density.value) / 100, 0, 1) : 0;
	}

	function readDensity() {
		const t = sliderT();
		const minLive = Math.max(40, Math.round(nVeh * 0.06));
		return Math.max(minLive, Math.round(minLive + t * (nVeh - minLive)));
	}

	function moshAmount() {
		const t = sliderT();
		if (t <= 0.5) return 0;
		const u = (t - 0.5) / 0.5;
		return u * u;
	}

	function paintDensity() {
		const pct = density ? `${density.value}%` : '100%';
		density?.parentElement?.parentElement?.style.setProperty('--loudness-traffic', pct);
	}

	let liveCount = readDensity();
	paintDensity();
	density?.addEventListener('input', () => {
		liveCount = readDensity();
		paintDensity();
	});

	function applyLiveCount() {
		cars.count = liveCount;
		trailGeo.setDrawRange(0, liveCount * trailSegs * 2);
		cars.instanceMatrix.needsUpdate = true;
		trailGeo.attributes.position.needsUpdate = true;
		trailGeo.attributes.color.needsUpdate = true;
	}

	function stepTraffic(dt) {
		for (let i = 0; i < liveCount; i++) {
			const v = vehicles[i];
			let e = city.directed[v.edge];
			if (!e) continue;
			v.t += (v.speed * dt) / e.len;
			let guard = 0;
			while (v.t >= 1 && guard++ < 4) {
				v.t -= 1;
				const node = city.nodes[e.b];
				const nextId = pickNext(node, v.edge ^ 1, e, city.directed, rng);
				v.edge = nextId;
				e = city.directed[v.edge];
				if (!e) break;
			}
			placeVehicle(v, i);
		}
		applyLiveCount();
	}

	for (let i = 0; i < vehicles.length; i++) {
		const v = vehicles[i];
		const e = city.directed[v.edge];
		if (!e) continue;
		const x = e.x0 + (e.x1 - e.x0) * v.t;
		const z = e.z0 + (e.z1 - e.z0) * v.t;
		for (const p of trailHist[i]) {
			p[0] = x;
			p[1] = 0.55;
			p[2] = z;
		}
		placeVehicle(v, i);
	}

	const look = new THREE.Vector3(40, 20, -20);
	const camPos = new THREE.Vector3();
	let azimuth = 0.62;
	const elev = THREE.MathUtils.degToRad(39);
	const radius = 305;

	function placeCamera(t) {
		const mx = ((window.cMouseX ?? window.innerWidth * 0.5) / window.innerWidth - 0.5) * 0.1;
		const my = ((window.cMouseY ?? window.innerHeight * 0.5) / window.innerHeight - 0.5) * 0.04;
		azimuth = 0.95 + t * 0.005 + mx;
		const el = elev + my + Math.sin(t * 0.06) * 0.012;
		camPos.set(
			look.x + Math.cos(azimuth) * Math.cos(el) * radius,
			look.y + Math.sin(el) * radius,
			look.z + Math.sin(azimuth) * Math.cos(el) * radius,
		);
		camera.position.copy(camPos);
		camera.lookAt(look);
		camera.up.set(0, 1, 0);
	}

	const mosh = createLoudnessMosh(renderer);

	function onResize() {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight, false);
		mosh.resize();
	}
	window.addEventListener('resize', onResize);

	let last = performance.now();
	let raf = 0;
	placeCamera(0);
	stepTraffic(0);

	function frame(now) {
		raf = requestAnimationFrame(frame);
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		const t = now * 0.001;
		cityMat.uniforms.uTime.value = t;
		stepTraffic(dt);
		placeCamera(t);
		mosh.render(scene, camera, moshAmount(), t);
	}
	raf = requestAnimationFrame(frame);

	return () => {
		cancelAnimationFrame(raf);
		window.removeEventListener('resize', onResize);
		stopAudio();
		mosh.dispose();
		renderer.dispose();
	};
}
