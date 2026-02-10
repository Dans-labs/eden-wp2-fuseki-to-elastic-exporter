import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RdfDeltaClientService } from './rdf-delta-client.service';
import { RdfPatchParserService } from './rdf-patch-parser.service';
import { RdfDeltaChangeDetectionService } from './rdf-delta-change-detection.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    RdfDeltaClientService,
    RdfPatchParserService,
    RdfDeltaChangeDetectionService,
  ],
  exports: [
    RdfDeltaClientService,
    RdfPatchParserService,
    RdfDeltaChangeDetectionService,
  ],
})
export class RdfDeltaModule {}
