import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const MOSH_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tPrev;
uniform float uAmount;
uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

void main() {
	float a = uAmount;
	vec2 uv = vUv;
	vec2 px = 1.0 / uResolution;

	if (a < 0.0004) {
		gl_FragColor = texture2D(tScene, uv);
		return;
	}

	float a2 = a * a;
	float shakePx = mix(0.5, 7.0, a2);
	vec2 shake = vec2(
		sin(uTime * 97.0 + uv.y * 52.0),
		cos(uTime * 113.0 + uv.x * 47.0)
	) * shakePx * px;

	float bpx = mix(64.0, 14.0, a);
	vec2 bid = floor((uv * uResolution) / bpx);
	float tick = floor(uTime * mix(0.35, 5.5, a));
	float h = hash21(bid + tick);
	float h2 = hash21(bid + 17.13);
	float h3 = hash21(vec2(bid.y * 3.1, tick));

	vec2 blockShift = (vec2(h, h2) - 0.5) * px * mix(1.2, 42.0, a2) * step(0.62, h3);

	float bandId = floor(uv.y * mix(5.0, 48.0, a) + uTime * 1.4);
	float band = hash21(vec2(bandId, floor(uTime * 3.2)));
	vec2 tear = vec2((band - 0.5) * mix(0.0, 0.09, a2) * step(0.84, band), 0.0);

	vec2 uvd = clamp(uv + shake + blockShift + tear, 0.0, 1.0);

	float aberration = mix(0.3, 4.2, a2);
	vec2 chroma = vec2(aberration, 0.0) * px * (h2 * 2.0 - 1.0);

	vec3 fresh = vec3(
		texture2D(tScene, uvd + chroma).r,
		texture2D(tScene, uvd).g,
		texture2D(tScene, uvd - chroma).b
	);

	vec2 mv = (vec2(h, h2) - 0.5) * mix(0.0015, 0.028, a);
	vec3 stuck = texture2D(tPrev, clamp(uv + mv + shake * 0.35 + vec2(tear.x * 0.35, 0.0), 0.0, 1.0)).rgb;

	float freeze = step(0.84 - a * 0.28, h);
	float smear = freeze * mix(0.28, 0.86, a) + (1.0 - freeze) * 0.1 * a;
	vec3 color = mix(fresh, stuck, clamp(smear, 0.0, 0.88));

	gl_FragColor = vec4(color, 1.0);
}
`;

const COPY_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
	gl_FragColor = texture2D(tDiffuse, vUv);
}
`;

function makeTarget(w, h, filter, samples) {
	const rt = new THREE.WebGLRenderTarget(w, h, {
		minFilter: filter,
		magFilter: filter,
		format: THREE.RGBAFormat,
		type: THREE.UnsignedByteType,
		depthBuffer: samples > 0 || filter === THREE.NearestFilter,
		stencilBuffer: false,
		samples,
	});
	rt.texture.colorSpace = THREE.NoColorSpace;
	return rt;
}

export function createLoudnessMosh(renderer) {
	const size = new THREE.Vector2();
	renderer.getDrawingBufferSize(size);

	let sceneRT = makeTarget(size.x, size.y, THREE.NearestFilter, 0);
	sceneRT.depthBuffer = true;
	let ping = makeTarget(size.x, size.y, THREE.LinearFilter, 0);
	let pong = makeTarget(size.x, size.y, THREE.LinearFilter, 0);
	ping.depthBuffer = false;
	pong.depthBuffer = false;

	const moshMat = new THREE.ShaderMaterial({
		uniforms: {
			tScene: { value: sceneRT.texture },
			tPrev: { value: ping.texture },
			uAmount: { value: 0 },
			uTime: { value: 0 },
			uResolution: { value: size.clone() },
		},
		vertexShader: VERT,
		fragmentShader: MOSH_FRAG,
		depthTest: false,
		depthWrite: false,
		toneMapped: false,
	});

	const copyMat = new THREE.ShaderMaterial({
		uniforms: { tDiffuse: { value: pong.texture } },
		vertexShader: VERT,
		fragmentShader: COPY_FRAG,
		depthTest: false,
		depthWrite: false,
		toneMapped: false,
	});

	const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), moshMat);
	const blit = new THREE.Scene();
	blit.add(quad);
	const blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

	let seeded = false;

	function resize() {
		renderer.getDrawingBufferSize(size);
		const w = Math.max(1, size.x | 0);
		const h = Math.max(1, size.y | 0);
		sceneRT.setSize(w, h);
		ping.setSize(w, h);
		pong.setSize(w, h);
		moshMat.uniforms.uResolution.value.set(w, h);
		seeded = false;
	}

	function render(scene, camera, amount, time) {
		if (amount <= 0.0004) {
			renderer.setRenderTarget(null);
			renderer.render(scene, camera);
			seeded = false;
			return;
		}

		renderer.setRenderTarget(sceneRT);
		renderer.render(scene, camera);

		if (!seeded) {
			copyMat.uniforms.tDiffuse.value = sceneRT.texture;
			quad.material = copyMat;
			renderer.setRenderTarget(ping);
			renderer.render(blit, blitCam);
			seeded = true;
		}

		moshMat.uniforms.tScene.value = sceneRT.texture;
		moshMat.uniforms.tPrev.value = ping.texture;
		moshMat.uniforms.uAmount.value = amount;
		moshMat.uniforms.uTime.value = time;
		quad.material = moshMat;

		renderer.setRenderTarget(pong);
		renderer.render(blit, blitCam);

		copyMat.uniforms.tDiffuse.value = pong.texture;
		quad.material = copyMat;
		renderer.setRenderTarget(null);
		renderer.render(blit, blitCam);

		const swap = ping;
		ping = pong;
		pong = swap;
	}

	function dispose() {
		sceneRT.dispose();
		ping.dispose();
		pong.dispose();
		moshMat.dispose();
		copyMat.dispose();
		quad.geometry.dispose();
	}

	return { render, resize, dispose };
}
