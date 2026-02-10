import { registerAs } from '@nestjs/config';
import z from 'zod';

export const ElasticsearchConfigSchema = z.object({
  ELASTICSEARCH_URL: z.url(),
  ELASTICSEARCH_ALIAS: z.string().min(1),
  ELASTICSEARCH_USERNAME: z.string().optional(),
  ELASTICSEARCH_PASSWORD: z.string().optional(),
});

export const ELASTICSEARCH_CONFIG_KEY = Symbol('app:config:elasticsearch');

export type ElasticsearchConfig = z.infer<typeof ElasticsearchConfigSchema>;

export default registerAs(
  ELASTICSEARCH_CONFIG_KEY,
  (): ElasticsearchConfig =>
    ElasticsearchConfigSchema.parse({
      ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL,
      ELASTICSEARCH_ALIAS: process.env.ELASTICSEARCH_ALIAS,
      ELASTICSEARCH_USERNAME: process.env.ELASTICSEARCH_USERNAME,
      ELASTICSEARCH_PASSWORD: process.env.ELASTICSEARCH_PASSWORD,
    }),
);
