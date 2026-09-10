/// <reference types="astro/client" />

declare module '*.yml?raw' {
	const content: string;
	export default content;
}

export {};

declare global {
	interface Window {
		cMouseX: number;
		cMouseY: number;
	}
}
