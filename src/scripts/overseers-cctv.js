import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import cctvUrl from '../../assets/3d/cctv.fbx?url';

const HEAD_FOLLOW = 0.16;

function makeScratchMaps() {
	const size = 512;
	const color = document.createElement('canvas');
	const rough = document.createElement('canvas');
	color.width = color.height = rough.width = rough.height = size;
	const c = color.getContext('2d');
	const r = rough.getContext('2d');

	c.fillStyle = '#e6e6e6';
	c.fillRect(0, 0, size, size);
	r.fillStyle = '#c8c8c8';
	r.fillRect(0, 0, size, size);

	const cPix = c.getImageData(0, 0, size, size);
	const rPix = r.getImageData(0, 0, size, size);
	for (let i = 0; i < cPix.data.length; i += 4) {
		const n = (Math.random() - 0.5) * 18;
		cPix.data[i] += n;
		cPix.data[i + 1] += n;
		cPix.data[i + 2] += n;
		const grain = 180 + Math.random() * 40;
		rPix.data[i] = rPix.data[i + 1] = rPix.data[i + 2] = grain;
	}
	c.putImageData(cPix, 0, 0);
	r.putImageData(rPix, 0, 0);

	const scratch = (ctx, count, stroke, width, alpha) => {
		ctx.save();
		for (let i = 0; i < count; i++) {
			ctx.strokeStyle = stroke;
			ctx.globalAlpha = alpha * (0.45 + Math.random() * 0.55);
			ctx.lineWidth = width * (0.4 + Math.random());
			ctx.beginPath();
			const x = Math.random() * size;
			const y = Math.random() * size;
			const len = 30 + Math.random() * 220;
			const a = (Math.random() - 0.5) * 0.55 + (Math.random() < 0.15 ? Math.PI / 2 : 0);
			ctx.moveTo(x, y);
			ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
			ctx.stroke();
		}
		ctx.restore();
	};

	scratch(c, 70, 'rgba(210,210,210,0.7)', 1.2, 0.28);
	scratch(c, 36, 'rgba(90,90,90,0.85)', 1.6, 0.4);
	scratch(c, 16, 'rgba(55,55,55,0.95)', 2.4, 0.28);
	scratch(r, 70, 'rgba(55,55,55,1)', 1.3, 0.62);
	scratch(r, 36, 'rgba(235,235,235,1)', 1.1, 0.4);

	const tex = (canvas, srgb) => {
		const t = new THREE.CanvasTexture(canvas);
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		t.repeat.set(2.2, 2.2);
		t.anisotropy = 4;
		if (srgb) t.colorSpace = THREE.SRGBColorSpace;
		t.needsUpdate = true;
		return t;
	};

	return { map: tex(color, true), roughnessMap: tex(rough, false) };
}

function makeEnvMap(renderer) {
	const envScene = new THREE.Scene();
	envScene.background = new THREE.Color(0x2c2c2c);
	const panel = (hex, pos, rot) => {
		const mesh = new THREE.Mesh(
			new THREE.PlaneGeometry(10, 10),
			new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide }),
		);
		mesh.position.copy(pos);
		mesh.rotation.copy(rot);
		envScene.add(mesh);
	};
	panel(0xeeeeee, new THREE.Vector3(0, 7, 0), new THREE.Euler(-Math.PI / 2, 0, 0));
	panel(0x1a1a1a, new THREE.Vector3(0, -5, 0), new THREE.Euler(Math.PI / 2, 0, 0));
	panel(0xd8dde4, new THREE.Vector3(-6.5, 2, 0), new THREE.Euler(0, Math.PI / 2, 0));
	panel(0x3a3a42, new THREE.Vector3(6.5, 1.5, 0), new THREE.Euler(0, -Math.PI / 2, 0));
	panel(0xc4c4c4, new THREE.Vector3(0, 2, 6.5), new THREE.Euler(0, Math.PI, 0));
	panel(0x252528, new THREE.Vector3(0, 2, -6.5), new THREE.Euler(0, 0, 0));
	const pmrem = new THREE.PMREMGenerator(renderer);
	const tex = pmrem.fromScene(envScene, 0.04).texture;
	pmrem.dispose();
	return tex;
}

function ensureUv(geometry) {
	if (geometry.getAttribute('uv')) return;
	if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
	geometry.computeBoundingBox();
	const box = geometry.boundingBox;
	const size = new THREE.Vector3();
	box.getSize(size);
	const pos = geometry.getAttribute('position');
	const nrm = geometry.getAttribute('normal');
	const uv = new Float32Array(pos.count * 2);
	for (let i = 0; i < pos.count; i++) {
		const x = (pos.getX(i) - box.min.x) / (size.x || 1);
		const y = (pos.getY(i) - box.min.y) / (size.y || 1);
		const z = (pos.getZ(i) - box.min.z) / (size.z || 1);
		const nx = Math.abs(nrm.getX(i));
		const ny = Math.abs(nrm.getY(i));
		const nz = Math.abs(nrm.getZ(i));
		if (nx >= ny && nx >= nz) {
			uv[i * 2] = z;
			uv[i * 2 + 1] = y;
		} else if (ny >= nx && ny >= nz) {
			uv[i * 2] = x;
			uv[i * 2 + 1] = z;
		} else {
			uv[i * 2] = x;
			uv[i * 2 + 1] = y;
		}
	}
	geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function isLens(obj) {
	const mat = obj.material;
	const matName = Array.isArray(mat) ? mat.map((m) => m?.name || '').join(' ') : mat?.name || '';
	const label = `${obj.name} ${obj.parent?.name || ''} ${matName}`.toLowerCase();
	return /glass|lens/.test(label);
}

export function createCctvMask(signal) {
	const canvas = document.createElement('canvas');
	const renderer = new THREE.WebGLRenderer({
		canvas,
		alpha: true,
		antialias: false,
		powerPreference: 'high-performance',
		premultipliedAlpha: false,
	});
	renderer.setClearColor(0x000000, 0);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.05;

	const scene = new THREE.Scene();
	scene.background = null;
	const envMap = makeEnvMap(renderer);
	scene.environment = envMap;

	const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 40);
	camera.position.set(0, 0.12, 4.2);
	camera.lookAt(0, 0, 0);

	scene.add(new THREE.AmbientLight(0x2a2a2a, 0.16));
	const key = new THREE.DirectionalLight(0xf2f2f2, 2.55);
	key.position.set(4.4, 5.8, 3.2);
	scene.add(key);
	const fill = new THREE.DirectionalLight(0x6e7682, 0.22);
	fill.position.set(-3.8, 0.6, 2.4);
	scene.add(fill);
	const rim = new THREE.DirectionalLight(0xc9d2dc, 0.85);
	rim.position.set(-1.4, 3.2, -4.6);
	scene.add(rim);
	const glint = new THREE.PointLight(0xffffff, 18, 12, 2);
	glint.position.set(1.6, 2.2, 3.4);
	scene.add(glint);

	const pivot = new THREE.Group();
	scene.add(pivot);
	const hold = new THREE.Group();
	hold.rotation.set(0, -Math.PI / 2, 0);
	pivot.add(hold);

	const scratches = makeScratchMaps();
	const plastic = new THREE.MeshStandardMaterial({
		color: 0xe4e4e4,
		map: scratches.map,
		roughnessMap: scratches.roughnessMap,
		roughness: 0.88,
		metalness: 0.03,
		envMapIntensity: 0.22,
	});
	const lens = new THREE.MeshStandardMaterial({
		color: 0x060606,
		roughness: 0.11,
		metalness: 0.72,
		envMapIntensity: 0.8,
	});

	const targetQ = new THREE.Quaternion();
	const scratchM = new THREE.Matrix4();
	const scratchR = new THREE.Matrix4();
	const scratchE = new THREE.Euler(0, 0, 0, 'YXZ');

	let loaded = false;

	new FBXLoader().load(
		cctvUrl,
		(group) => {
			if (signal?.aborted) return;
			group.traverse((obj) => {
				if (obj.isLight) obj.visible = false;
				if (!obj.isMesh) return;
				obj.frustumCulled = true;
				obj.castShadow = false;
				obj.receiveShadow = false;
				ensureUv(obj.geometry);
				const glass = isLens(obj);
				obj.material = glass ? lens : plastic;
				if (glass) obj.renderOrder = 2;
			});
			const box = new THREE.Box3().setFromObject(group);
			const size = box.getSize(new THREE.Vector3());
			const center = box.getCenter(new THREE.Vector3());
			const span = Math.max(size.x, size.y, size.z) || 1;
			group.position.sub(center);
			hold.scale.setScalar(1.72 / span);
			hold.add(group);
			loaded = true;
		},
		undefined,
		() => {
			loaded = false;
		},
	);

	function resize(w, h, dpr) {
		const ratio = Math.min(dpr || 1, 1.5);
		renderer.setPixelRatio(ratio);
		renderer.setSize(w, h, false);
		camera.aspect = w / Math.max(1, h);
		camera.updateProjectionMatrix();
	}

	function setHeadFromMatrix(data) {
		if (!data || data.length < 16) return;
		scratchM.set(
			data[0],
			data[1],
			data[2],
			data[3],
			data[4],
			data[5],
			data[6],
			data[7],
			data[8],
			data[9],
			data[10],
			data[11],
			data[12],
			data[13],
			data[14],
			data[15],
		);
		scratchR.extractRotation(scratchM);
		scratchE.setFromRotationMatrix(scratchR, 'YXZ');
		scratchE.x = -scratchE.x;
		scratchE.z = 0;
		scratchE.x = THREE.MathUtils.clamp(scratchE.x, -0.72, 0.72);
		scratchE.y = THREE.MathUtils.clamp(scratchE.y, -1.15, 1.15);
		targetQ.setFromEuler(scratchE);
	}

	function render() {
		pivot.quaternion.slerp(targetQ, HEAD_FOLLOW);
		renderer.render(scene, camera);
	}

	function dispose() {
		renderer.dispose();
		hold.clear();
		plastic.dispose();
		lens.dispose();
		scratches.map.dispose();
		scratches.roughnessMap.dispose();
		envMap.dispose();
	}

	return { canvas, resize, setHeadFromMatrix, render, dispose, isLoaded: () => loaded };
}
