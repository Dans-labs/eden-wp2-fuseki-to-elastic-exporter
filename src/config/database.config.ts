import { registerAs } from '@nestjs/config';
import z from 'zod';

export const DatabaseConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
});

export const DATABASE_CONFIG_KEY = Symbol('app:config:database');
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

export default registerAs(
  DATABASE_CONFIG_KEY,
  (): DatabaseConfig =>
    DatabaseConfigSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL,
    }),
);
