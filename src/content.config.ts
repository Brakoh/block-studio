import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects_edit = defineCollection({
	loader: glob({
		pattern: '**/*.md',
		base: './src/content/projects_edit',
	}),
	schema: z.object({
		title: z.string(),
		tag: z.string(),
		inscription: z.string(),
		url: z.string(),
	}),
});

export const collections = { projects_edit };
