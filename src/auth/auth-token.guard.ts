import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { AUTH_CONFIG_KEY, type AuthConfig } from '../config';
import type { Request } from 'express';

@Injectable()
export class AuthTokenGuard implements CanActivate {
  private readonly apiToken: string;

  constructor(private readonly configService: ConfigService) {
    const authConfig = this.configService.get<AuthConfig>(AUTH_CONFIG_KEY);
    this.apiToken = authConfig!.AUTH_API_TOKEN;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization header format');
    }

    if (!this.isTokenValid(token)) {
      throw new UnauthorizedException('Invalid API token');
    }

    return true;
  }

  private isTokenValid(token: string): boolean {
    const tokenBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(this.apiToken);

    if (tokenBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(tokenBuffer, expectedBuffer);
  }
}
