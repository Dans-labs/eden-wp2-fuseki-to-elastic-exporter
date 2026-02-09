import z from 'zod';
import { CoreConfigSchema } from './core.config';

export const EnvironmentConfigSchema = CoreConfigSchema;

export type EnvironmentConfigVariables = z.infer<
  typeof EnvironmentConfigSchema
>;
