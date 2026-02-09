import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import {
  coreConfig,
  elasticsearchConfig,
  fusekiConfig,
  EnvironmentConfigSchema,
} from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: false,
      cache: true,
      load: [coreConfig, fusekiConfig, elasticsearchConfig],
      validate: (env) => EnvironmentConfigSchema.parse(env),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
