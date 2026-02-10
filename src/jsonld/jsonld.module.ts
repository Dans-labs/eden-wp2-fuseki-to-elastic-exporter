import { Module } from '@nestjs/common';
import { JsonldProcessingService } from './jsonld-processing.service';

@Module({
  providers: [JsonldProcessingService],
  exports: [JsonldProcessingService],
})
export class JsonldModule {}
