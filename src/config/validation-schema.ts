import z from 'zod';
import { AuthConfigSchema } from './auth.config';
import { CoreConfigSchema } from './core.config';
import { DatabaseConfigSchema } from './database.config';
import { ElasticsearchConfigSchema } from './elasticsearch.config';
import { FusekiConfigSchema } from './fuseki.config';
import { SyncConfigSchema } from './sync.config';
import { RedisConfigSchema } from './redis.config';
import { RdfDeltaConfigSchema } from './rdf-delta.config';

const BaseSchema = CoreConfigSchema.merge(FusekiConfigSchema)
  .merge(ElasticsearchConfigSchema)
  .merge(AuthConfigSchema)
  .merge(DatabaseConfigSchema)
  .merge(SyncConfigSchema)
  .merge(RedisConfigSchema)
  .merge(RdfDeltaConfigSchema);

// When CHANGE_DETECTION_MODE is 'delta', RDF_DELTA_URL and
// RDF_DELTA_DATASOURCE become required.
export const EnvironmentConfigSchema = BaseSchema.refine(
  (data) => {
    if (data.CHANGE_DETECTION_MODE === 'delta') {
      return !!data.RDF_DELTA_URL && !!data.RDF_DELTA_DATASOURCE;
    }
    return true;
  },
  {
    message:
      'RDF_DELTA_URL and RDF_DELTA_DATASOURCE are required when CHANGE_DETECTION_MODE is "delta"',
    path: ['RDF_DELTA_URL'],
  },
);

export type EnvironmentConfigVariables = z.infer<typeof BaseSchema>;
export type EnvironmentConfigInput = z.input<typeof BaseSchema>;
