import { registerAs } from '@nestjs/config';
import z from 'zod';

export const RedisConfigSchema = z.object({
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().min(1).max(65535).default(6379),
});

export const REDIS_CONFIG_KEY = Symbol('app:config:redis');
export type RedisConfig = z.infer<typeof RedisConfigSchema>;

export default registerAs(
  REDIS_CONFIG_KEY,
  (): RedisConfig =>
    RedisConfigSchema.parse({
      REDIS_HOST: process.env.REDIS_HOST,
      REDIS_PORT: process.env.REDIS_PORT,
    }),
);
