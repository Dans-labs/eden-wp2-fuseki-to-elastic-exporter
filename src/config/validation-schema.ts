import z from 'zod';
import { AuthConfigSchema } from './auth.config';
import { CoreConfigSchema } from './core.config';
import { DatabaseConfigSchema } from './database.config';
import { ElasticsearchConfigSchema } from './elasticsearch.config';
import { FusekiConfigSchema } from './fuseki.config';
import { RedisConfigSchema } from './redis.config';

const BaseSchema = CoreConfigSchema.and(FusekiConfigSchema)
  .and(ElasticsearchConfigSchema)
  .and(AuthConfigSchema)
  .and(DatabaseConfigSchema)
  .and(RedisConfigSchema);

export const EnvironmentConfigSchema = BaseSchema;

export type EnvironmentConfigVariables = z.infer<typeof BaseSchema>;
export type EnvironmentConfigInput = z.input<typeof BaseSchema>;
