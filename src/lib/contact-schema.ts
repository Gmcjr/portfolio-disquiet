import { z } from 'zod';

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .transform((value) => value.replace(/[\r\n\t\p{Cc}]/gu, '')),
  email: z.email().max(254),
  message: z.string().trim().min(1).max(2000),
  _gotcha: z.string().max(100).optional().default(''),
  elapsedMs: z.number().int().nonnegative(),
});

export type ContactInput = z.infer<typeof contactSchema>;
