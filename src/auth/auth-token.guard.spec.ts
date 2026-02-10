import { TestBed } from '@suites/unit';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AuthTokenGuard } from './auth-token.guard';
import { AUTH_CONFIG_KEY } from '../config';

describe('AuthTokenGuard', () => {
  const validToken = 'a'.repeat(32);
  let guard: AuthTokenGuard;

  const createMockContext = (authHeader?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: authHeader,
          },
        }),
      }),
    }) as ExecutionContext;

  beforeEach(async () => {
    const { unit } = await TestBed.solitary(AuthTokenGuard)
      .mock(ConfigService)
      .impl(() => ({
        get: jest.fn().mockImplementation((key: symbol) => {
          if (key === AUTH_CONFIG_KEY) {
            return { AUTH_API_TOKEN: validToken };
          }
          return undefined;
        }),
      }))
      .compile();

    guard = unit;
  });

  describe('canActivate', () => {
    it('should return true for a valid Bearer token', () => {
      const context = createMockContext(`Bearer ${validToken}`);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when Authorization header is missing', () => {
      const context = createMockContext(undefined);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        'Missing Authorization header',
      );
    });

    it('should throw UnauthorizedException when scheme is not Bearer', () => {
      const context = createMockContext(`Basic ${validToken}`);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        'Invalid Authorization header format',
      );
    });

    it('should throw UnauthorizedException when token is missing after Bearer', () => {
      const context = createMockContext('Bearer ');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token is invalid', () => {
      const wrongToken = 'b'.repeat(32);
      const context = createMockContext(`Bearer ${wrongToken}`);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid API token');
    });

    it('should throw UnauthorizedException when token has different length', () => {
      const shortToken = 'a'.repeat(16);
      const context = createMockContext(`Bearer ${shortToken}`);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid API token');
    });

    it('should throw UnauthorizedException for Bearer-only header without token', () => {
      const context = createMockContext('Bearer');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });
});
