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
        const result = EnvironmentConfigSchema.safeParse({
          API_PORT: env.API_PORT,
          API_PREFIX: env.API_PREFIX,
        });

        expect(result.success).toBe(false);
      });
    });

    describe('API_PORT', () => {
      it('should default to 3000 when omitted', () => {
        const result = EnvironmentConfigSchema.parse({
          NODE_ENV: env.NODE_ENV,
          API_PREFIX: env.API_PREFIX,
        });

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

    describe('API_PREFIX', () => {
      it('should default to "api" when omitted', () => {
        const result = EnvironmentConfigSchema.parse({
          NODE_ENV: env.NODE_ENV,
          API_PORT: env.API_PORT,
        });

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
});
