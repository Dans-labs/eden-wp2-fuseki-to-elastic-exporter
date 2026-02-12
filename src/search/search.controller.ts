import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller(':index')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('_search')
  async search(
    @Param('index') index: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.searchService.search(index, body);
  }

  @Get('_source/:id')
  async getSource(@Param('index') index: string, @Param('id') id: string) {
    return this.searchService.getSource(index, id);
  }
}
