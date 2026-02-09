import { registerAs } from '@nestjs/config';
import z from 'zod';

export const ElasticsearchConfigSchema = z.object({
  /**
   * The URL of the Elasticsearch instance to index documents into.
   */
  ELASTICSEARCH_URL: z.string().url(),

  /**
   * The Elasticsearch index alias the application targets.
   */
  ELASTICSEARCH_ALIAS: z.string().min(1),
});

export const ELASTICSEARCH_CONFIG_KEY = Symbol('app:config:elasticsearch');

export type ElasticsearchConfig = z.infer<typeof ElasticsearchConfigSchema>;

export default registerAs(
  ELASTICSEARCH_CONFIG_KEY,
  (): ElasticsearchConfig =>
    ElasticsearchConfigSchema.parse({
      ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL,
      ELASTICSEARCH_ALIAS: process.env.ELASTICSEARCH_ALIAS,
    }),
);
