import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthTokenGuard } from './auth-token.guard';

@Module({
  imports: [ConfigModule],
  providers: [AuthTokenGuard],
  exports: [AuthTokenGuard],
})
export class AuthModule {}
