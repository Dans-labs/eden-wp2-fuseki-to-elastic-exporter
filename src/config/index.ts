export {
  default as authConfig,
  AUTH_CONFIG_KEY,
  AuthConfigSchema,
} from './auth.config';
export type { AuthConfig } from './auth.config';

export {
  default as coreConfig,
  CORE_CONFIG_KEY,
  CoreConfigSchema,
} from './core.config';
export type { CoreConfig } from './core.config';

export {
  default as elasticsearchConfig,
  ELASTICSEARCH_CONFIG_KEY,
  ElasticsearchConfigSchema,
} from './elasticsearch.config';
export type { ElasticsearchConfig } from './elasticsearch.config';

export {
  default as fusekiConfig,
  FUSEKI_CONFIG_KEY,
  FusekiConfigSchema,
} from './fuseki.config';
export type { FusekiConfig } from './fuseki.config';

export {
  default as databaseConfig,
  DATABASE_CONFIG_KEY,
  DatabaseConfigSchema,
} from './database.config';
export type { DatabaseConfig } from './database.config';

export {
  default as redisConfig,
  REDIS_CONFIG_KEY,
  RedisConfigSchema,
} from './redis.config';
export type { RedisConfig } from './redis.config';

export { EnvironmentConfigSchema } from './validation-schema';
export type {
  EnvironmentConfigVariables,
  EnvironmentConfigInput,
} from './validation-schema';
