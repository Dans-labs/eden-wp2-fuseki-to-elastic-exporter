import { registerAs } from '@nestjs/config';
import z from 'zod';

export const AuthConfigSchema = z.object({
  /**
   * The API token required to authorize requests.
   * Must be at least 32 characters for minimum security.
   */
  AUTH_API_TOKEN: z.string().min(32),
});

export const AUTH_CONFIG_KEY = Symbol('app:config:auth');

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

export default registerAs(
  AUTH_CONFIG_KEY,
  (): AuthConfig =>
    AuthConfigSchema.parse({
      AUTH_API_TOKEN: process.env.AUTH_API_TOKEN,
    }),
);
