import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { ExportService } from './export.service';

@Controller('export')
@UseGuards(AuthTokenGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get()
  async triggerExport(): Promise<{ message: string }> {
    await this.exportService.exportAll();
    return { message: 'Export completed successfully' };
  }
}
