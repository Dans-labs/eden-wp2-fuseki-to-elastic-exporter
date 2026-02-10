import {
  EnvironmentConfigSchema,
  EnvironmentConfigVariables,
} from './validation-schema';

describe('Configuration Validation Schemas', () => {
  let env: EnvironmentConfigVariables;

  beforeEach(() => {
    env = {
      NODE_ENV: 'development',
      API_PORT: 3000,
      API_PREFIX: 'api',
      FUSEKI_ENDPOINT: 'http://localhost:3030/ds',
      ELASTICSEARCH_URL: 'http://localhost:9200',
      ELASTICSEARCH_ALIAS: 'eden',
      AUTH_API_TOKEN: 'a'.repeat(32),
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/eden',
    };
  });

  describe('CoreConfigSchema', () => {
    describe('with all valid values', () => {
      it('should parse correctly and return expected values', () => {
        const result = EnvironmentConfigSchema.parse(env);

        expect(result.NODE_ENV).toBe('development');
        expect(result.API_PORT).toBe(3000);
        expect(result.API_PREFIX).toBe('api');
      });
    });

    describe('NODE_ENV', () => {
      it('should accept "development"', () => {
        env.NODE_ENV = 'development';

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.NODE_ENV).toBe('development');
      });

      it('should accept "production"', () => {
        env.NODE_ENV = 'production';

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.NODE_ENV).toBe('production');
      });

      it('should accept "test"', () => {
        env.NODE_ENV = 'test';

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.NODE_ENV).toBe('test');
      });

      it('should reject an invalid value', () => {
        const result = EnvironmentConfigSchema.safeParse({
          ...env,
          NODE_ENV: 'staging',
        });

        expect(result.success).toBe(false);
      });

      it('should reject when missing', () => {
        const partial: Partial<EnvironmentConfigVariables> = { ...env };
        delete partial.NODE_ENV;

        const result = EnvironmentConfigSchema.safeParse(partial);

        expect(result.success).toBe(false);
      });
    });

    describe('API_PORT', () => {
      it('should default to 3000 when omitted', () => {
        const partial: Partial<EnvironmentConfigVariables> = { ...env };
        delete partial.API_PORT;

        const result = EnvironmentConfigSchema.parse(partial);

        expect(result.API_PORT).toBe(3000);
      });

      it('should accept a valid port number', () => {
        env.API_PORT = 8080;

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.API_PORT).toBe(8080);
      });

      it('should coerce a string to a number', () => {
        const result = EnvironmentConfigSchema.parse({
          ...env,
          API_PORT: '8080',
        });

        expect(result.API_PORT).toBe(8080);
      });

      it('should accept minimum value 1', () => {
        env.API_PORT = 1;

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.API_PORT).toBe(1);
      });

      it('should accept maximum value 65535', () => {
        env.API_PORT = 65535;

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.API_PORT).toBe(65535);
      });

      it('should reject 0', () => {
        const result = EnvironmentConfigSchema.safeParse({
          ...env,
          API_PORT: 0,
        });

        expect(result.success).toBe(false);
      });

      it('should reject 65536', () => {
        const result = EnvironmentConfigSchema.safeParse({
          ...env,
          API_PORT: 65536,
        });

        expect(result.success).toBe(false);
      });

      it('should reject a non-numeric string', () => {
        const result = EnvironmentConfigSchema.safeParse({
          ...env,
          API_PORT: 'not-a-number',
        });

        expect(result.success).toBe(false);
      });
    });

    describe('FUSEKI_ENDPOINT', () => {
      it('should accept a valid URL', () => {
        env.FUSEKI_ENDPOINT = 'http://fuseki.example.com:3030/ds';

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.FUSEKI_ENDPOINT).toBe(
          'http://fuseki.example.com:3030/ds',
        );
      });

      it('should accept an HTTPS URL', () => {
        env.FUSEKI_ENDPOINT = 'https://fuseki.example.com/ds';

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.FUSEKI_ENDPOINT).toBe('https://fuseki.example.com/ds');
      });

      it('should reject when missing', () => {
        const partial: Partial<EnvironmentConfigVariables> = { ...env };
        delete partial.FUSEKI_ENDPOINT;

        const result = EnvironmentConfigSchema.safeParse(partial);

        expect(result.success).toBe(false);
      });

      it('should reject an invalid URL', () => {
        const result = EnvironmentConfigSchema.safeParse({
          ...env,
          FUSEKI_ENDPOINT: 'not-a-url',
        });

        expect(result.success).toBe(false);
      });

      it('should reject an empty string', () => {
        const result = EnvironmentConfigSchema.safeParse({
          ...env,
          FUSEKI_ENDPOINT: '',
        });

        expect(result.success).toBe(false);
      });
    });

    describe('API_PREFIX', () => {
      it('should default to "api" when omitted', () => {
        const partial: Partial<EnvironmentConfigVariables> = { ...env };
        delete partial.API_PREFIX;

        const result = EnvironmentConfigSchema.parse(partial);

        expect(result.API_PREFIX).toBe('api');
      });

      it('should accept a custom prefix', () => {
        env.API_PREFIX = 'v1';

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.API_PREFIX).toBe('v1');
      });

      it('should reject an empty string', () => {
        const result = EnvironmentConfigSchema.safeParse({
          ...env,
          API_PREFIX: '',
        });

        expect(result.success).toBe(false);
      });
    });
  });

  describe('AuthConfigSchema', () => {
    describe('AUTH_API_TOKEN', () => {
      it('should accept a valid token of 32 characters', () => {
        env.AUTH_API_TOKEN = 'a'.repeat(32);

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.AUTH_API_TOKEN).toBe('a'.repeat(32));
      });

      it('should accept a token longer than 32 characters', () => {
        env.AUTH_API_TOKEN = 'a'.repeat(64);

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.AUTH_API_TOKEN).toBe('a'.repeat(64));
      });

      it('should reject when missing', () => {
        const partial: Partial<EnvironmentConfigVariables> = { ...env };
        delete partial.AUTH_API_TOKEN;

        const result = EnvironmentConfigSchema.safeParse(partial);

        expect(result.success).toBe(false);
      });

      it('should reject a token shorter than 32 characters', () => {
        const result = EnvironmentConfigSchema.safeParse({
          ...env,
          AUTH_API_TOKEN: 'short',
        });

        expect(result.success).toBe(false);
      });

      it('should reject an empty string', () => {
        const result = EnvironmentConfigSchema.safeParse({
          ...env,
          AUTH_API_TOKEN: '',
        });

        expect(result.success).toBe(false);
      });
    });
  });

  describe('ElasticsearchConfigSchema', () => {
    describe('ELASTICSEARCH_URL', () => {
      it('should accept a valid HTTP URL', () => {
        env.ELASTICSEARCH_URL = 'http://elasticsearch.example.com:9200';

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.ELASTICSEARCH_URL).toBe(
          'http://elasticsearch.example.com:9200',
        );
      });

      it('should accept an HTTPS URL', () => {
        env.ELASTICSEARCH_URL = 'https://elasticsearch.example.com';

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.ELASTICSEARCH_URL).toBe(
          'https://elasticsearch.example.com',
        );
      });

      it('should reject when missing', () => {
        const partial: Partial<EnvironmentConfigVariables> = { ...env };
        delete partial.ELASTICSEARCH_URL;

        const result = EnvironmentConfigSchema.safeParse(partial);

        expect(result.success).toBe(false);
      });

      it('should reject an invalid URL', () => {
        const result = EnvironmentConfigSchema.safeParse({
          ...env,
          ELASTICSEARCH_URL: 'not-a-url',
        });

        expect(result.success).toBe(false);
      });

      it('should reject an empty string', () => {
        const result = EnvironmentConfigSchema.safeParse({
          ...env,
          ELASTICSEARCH_URL: '',
        });

        expect(result.success).toBe(false);
      });
    });

    describe('ELASTICSEARCH_ALIAS', () => {
      it('should accept a valid alias string', () => {
        env.ELASTICSEARCH_ALIAS = 'my-index-alias';

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.ELASTICSEARCH_ALIAS).toBe('my-index-alias');
      });

      it('should reject when missing', () => {
        const partial: Partial<EnvironmentConfigVariables> = { ...env };
        delete partial.ELASTICSEARCH_ALIAS;

        const result = EnvironmentConfigSchema.safeParse(partial);

        expect(result.success).toBe(false);
      });

      it('should reject an empty string', () => {
        const result = EnvironmentConfigSchema.safeParse({
          ...env,
          ELASTICSEARCH_ALIAS: '',
        });

        expect(result.success).toBe(false);
      });
    });
  });

  describe('DatabaseConfigSchema', () => {
    describe('DATABASE_URL', () => {
      it('should accept a valid PostgreSQL URL', () => {
        env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/eden';

        const result = EnvironmentConfigSchema.parse(env);

        expect(result.DATABASE_URL).toBe(
          'postgresql://postgres:postgres@localhost:5432/eden',
        );
      });

      it('should reject when missing', () => {
        const partial: Partial<EnvironmentConfigVariables> = { ...env };
        delete partial.DATABASE_URL;

        const result = EnvironmentConfigSchema.safeParse(partial);

        expect(result.success).toBe(false);
      });

      it('should reject an invalid URL', () => {
        const result = EnvironmentConfigSchema.safeParse({
          ...env,
          DATABASE_URL: 'not-a-url',
        });

        expect(result.success).toBe(false);
      });

      it('should reject an empty string', () => {
        const result = EnvironmentConfigSchema.safeParse({
          ...env,
          DATABASE_URL: '',
        });

        expect(result.success).toBe(false);
      });
    });
  });
});
