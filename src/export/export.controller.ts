import { Controller, Get } from '@nestjs/common';
import { ExportService } from './export.service';

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get()
  async triggerExport(): Promise<{ message: string }> {
    await this.exportService.exportAll();
    return { message: 'Export completed successfully' };
  }
}
