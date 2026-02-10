import z from 'zod';
import { AuthConfigSchema } from './auth.config';
import { CoreConfigSchema } from './core.config';
import { DatabaseConfigSchema } from './database.config';
import { ElasticsearchConfigSchema } from './elasticsearch.config';
import { FusekiConfigSchema } from './fuseki.config';

export const EnvironmentConfigSchema = CoreConfigSchema.merge(
  FusekiConfigSchema,
)
  .merge(ElasticsearchConfigSchema)
  .merge(AuthConfigSchema)
  .merge(DatabaseConfigSchema);

export type EnvironmentConfigVariables = z.infer<
  typeof EnvironmentConfigSchema
>;
