import z from 'zod';
import { CoreConfigSchema } from './core.config';
import { ElasticsearchConfigSchema } from './elasticsearch.config';
import { FusekiConfigSchema } from './fuseki.config';

export const EnvironmentConfigSchema = CoreConfigSchema.merge(
  FusekiConfigSchema,
).merge(ElasticsearchConfigSchema);

export type EnvironmentConfigVariables = z.infer<
  typeof EnvironmentConfigSchema
>;
