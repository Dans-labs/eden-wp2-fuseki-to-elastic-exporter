import { registerAs } from '@nestjs/config';
import z from 'zod';

export const SyncConfigSchema = z.object({
  SYNC_CRON: z.string().min(1).default('*/10 * * * *'),
  SYNC_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((val) => val === 'true'),
  CHANGE_DETECTION_MODE: z.enum(['delta', 'polling']).default('delta'),
});

export const SYNC_CONFIG_KEY = Symbol('app:config:sync');
export type SyncConfig = z.infer<typeof SyncConfigSchema>;

export default registerAs(
  SYNC_CONFIG_KEY,
  (): SyncConfig =>
    SyncConfigSchema.parse({
      SYNC_CRON: process.env.SYNC_CRON,
      SYNC_ENABLED: process.env.SYNC_ENABLED,
      CHANGE_DETECTION_MODE: process.env.CHANGE_DETECTION_MODE,
    }),
);
