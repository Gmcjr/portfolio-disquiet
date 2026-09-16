import { defineCollection, z, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';

const base = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(),
    summary: z.string().max(200),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
    cover: z.object({
      src: image(),
      alt: z.string(),
    }),
  });

const work = defineCollection({
  loader: glob({
    pattern: '**/index.{md,mdx}',
    base: './src/content/work',
    generateId: ({ entry }) => entry.split('/')[0] ?? entry,
  }),
  schema: (ctx) =>
    base(ctx).extend({
      role: z.string(),
      stack: z.array(z.string()),
      year: z.number().int(),
      links: z
        .array(z.object({ label: z.string(), href: z.url() }))
        .default([]),
      featured: z.boolean().default(false),
    }),
});

const writing = defineCollection({
  loader: glob({
    pattern: '**/index.{md,mdx}',
    base: './src/content/writing',
    generateId: ({ entry }) => entry.split('/')[0] ?? entry,
  }),
  schema: (ctx) => base(ctx).extend({ tags: z.array(z.string()).default([]) }),
});

const music = defineCollection({
  loader: glob({
    pattern: '**/index.{md,mdx}',
    base: './src/content/music',
    generateId: ({ entry }) => entry.split('/')[0] ?? entry,
  }),
  schema: (ctx) => base(ctx),
});

const art = defineCollection({
  loader: glob({
    pattern: '**/index.{md,mdx}',
    base: './src/content/art',
    generateId: ({ entry }) => entry.split('/')[0] ?? entry,
  }),
  schema: (ctx) => base(ctx),
});

export const collections = { work, writing, music, art };
