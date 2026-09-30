import { z } from 'zod';

const envSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  CONTACT_TO: z.email(),
  CONTACT_FROM: z.string().min(1),
  SITE_URL: z.string().min(1),
});

export const env = envSchema.parse(process.env);
