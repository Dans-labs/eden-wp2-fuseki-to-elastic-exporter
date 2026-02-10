import { registerAs } from '@nestjs/config';
import z from 'zod';

export const FusekiConfigSchema = z.object({
  /**
   * The URL of the Fuseki SPARQL endpoint to query against.
   */
  FUSEKI_ENDPOINT: z.url(),

  /**
   * The URL of the RDF Delta Patch Log Server.
   */
  RDF_DELTA_URL: z.url().optional(),

  /**
   * The RDF Delta datasource name to monitor.
   */
  RDF_DELTA_DATASOURCE: z.string().min(1).optional(),
});

export const FUSEKI_CONFIG_KEY = Symbol('app:config:fuseki');

export type FusekiConfig = z.infer<typeof FusekiConfigSchema>;

export default registerAs(
  FUSEKI_CONFIG_KEY,
  (): FusekiConfig =>
    FusekiConfigSchema.parse({
      FUSEKI_ENDPOINT: process.env.FUSEKI_ENDPOINT,
      RDF_DELTA_URL: process.env.RDF_DELTA_URL || undefined,
      RDF_DELTA_DATASOURCE: process.env.RDF_DELTA_DATASOURCE || undefined,
    }),
);
