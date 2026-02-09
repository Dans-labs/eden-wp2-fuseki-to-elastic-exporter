import z from 'zod';
import { CoreConfigSchema } from './core.config';
import { FusekiConfigSchema } from './fuseki.config';

export const EnvironmentConfigSchema =
  CoreConfigSchema.merge(FusekiConfigSchema);

export type EnvironmentConfigVariables = z.infer<
  typeof EnvironmentConfigSchema
>;
