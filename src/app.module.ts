import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { coreConfig, fusekiConfig, EnvironmentConfigSchema } from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: false,
      cache: true,
      load: [coreConfig, fusekiConfig],
      validate: (env) => EnvironmentConfigSchema.parse(env),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
