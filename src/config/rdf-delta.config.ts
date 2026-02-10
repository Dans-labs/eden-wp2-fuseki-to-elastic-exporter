import { registerAs } from '@nestjs/config';
import z from 'zod';

export const RdfDeltaConfigSchema = z.object({
  RDF_DELTA_URL: z.string().url().optional(),
  RDF_DELTA_DATASOURCE: z.string().min(1).optional(),
});

export const RDF_DELTA_CONFIG_KEY = Symbol('app:config:rdf-delta');
export type RdfDeltaConfig = z.infer<typeof RdfDeltaConfigSchema>;

export default registerAs(
  RDF_DELTA_CONFIG_KEY,
  (): RdfDeltaConfig =>
    RdfDeltaConfigSchema.parse({
      RDF_DELTA_URL: process.env.RDF_DELTA_URL || undefined,
      RDF_DELTA_DATASOURCE: process.env.RDF_DELTA_DATASOURCE || undefined,
    }),
);
