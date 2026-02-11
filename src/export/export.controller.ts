import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { ReindexService } from '../reindex/reindex.service';

@Controller('export')
@UseGuards(AuthTokenGuard)
export class ExportController {
  constructor(private readonly reindexService: ReindexService) {}

  @Get()
  async triggerExport(): Promise<{ message: string }> {
    await this.reindexService.reindexAll();
    return { message: 'Reindex completed successfully' };
  }
}
