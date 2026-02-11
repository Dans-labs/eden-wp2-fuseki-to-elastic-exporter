import { Module } from '@nestjs/common';
import { ReindexModule } from '../reindex/reindex.module';
import { AuthModule } from '../auth/auth.module';
import { ExportController } from './export.controller';

@Module({
  imports: [ReindexModule, AuthModule],
  controllers: [ExportController],
})
export class ExportModule {}
