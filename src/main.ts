import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService, ConfigType } from '@nestjs/config';
import { CORE_CONFIG_KEY, coreConfig } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const config =
    configService.getOrThrow<ConfigType<typeof coreConfig>>(CORE_CONFIG_KEY);

  app.setGlobalPrefix(config.API_PREFIX);
  await app.listen(config.API_PORT);
}

bootstrap().catch((err) => {
  console.error('Error during application bootstrap:', err);
  process.exit(1);
});
