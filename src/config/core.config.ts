import { registerAs } from '@nestjs/config';
import z from 'zod';

export const CoreConfigSchema = z.object({
  /**
   * The environment in which the application is running.
   */
  NODE_ENV: z.enum(['development', 'production', 'test']),

  /**
   * The port on which the application will run.
   */
  API_PORT: z.coerce.number().min(1).max(65535).default(3000),

  /**
   * The prefix for the API routes.
   */
  API_PREFIX: z.string().min(1).default('api'),
});

export const CORE_CONFIG_KEY = Symbol('app:config:core');

export type CoreConfig = z.infer<typeof CoreConfigSchema>;

export default registerAs(
  CORE_CONFIG_KEY,
  (): CoreConfig =>
    CoreConfigSchema.parse({
      NODE_ENV: process.env.NODE_ENV,
      API_PORT: process.env.API_PORT,
      API_PREFIX: process.env.API_PREFIX,
    }),
);
