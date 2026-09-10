// @ts-check
import { defineConfig } from 'astro/config';

const pages = process.env.GITHUB_ACTIONS === 'true';

// https://astro.build/config
export default defineConfig({
	site: 'https://brakoh.github.io',
	base: pages ? '/block-studio/' : '/',
});
