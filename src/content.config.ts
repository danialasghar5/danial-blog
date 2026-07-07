import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			tags: z.array(z.string()).default([]),
			draft: z.boolean().default(false),
		}),
});

const projects = defineCollection({
	loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			problem: z.string(),
			order: z.number(),
			featured: z.boolean().default(false),
			role: z.string().optional(),
			timeframe: z.string().optional(),
			tech: z.array(z.string()).default([]),
			// External links only when real — omit otherwise (no placeholders).
			liveUrl: z.string().url().optional(),
			repoUrl: z.string().url().optional(),
			highlights: z.array(z.string()).default([]),
			// Real numbers only. Left empty until verified figures exist.
			metrics: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
			heroImage: z.optional(image()),
			draft: z.boolean().default(false),
		}),
});

export const collections = { blog, projects };
