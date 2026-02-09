import { registerAs } from '@nestjs/config';
import z from 'zod';

export const FusekiConfigSchema = z.object({
  /**
   * The URL of the Fuseki SPARQL endpoint to query against.
   */
  FUSEKI_ENDPOINT: z.string().url(),
});

export const FUSEKI_CONFIG_KEY = Symbol('app:config:fuseki');

export type FusekiConfig = z.infer<typeof FusekiConfigSchema>;

export default registerAs(
  FUSEKI_CONFIG_KEY,
  (): FusekiConfig =>
    FusekiConfigSchema.parse({
      FUSEKI_ENDPOINT: process.env.FUSEKI_ENDPOINT,
    }),
);
