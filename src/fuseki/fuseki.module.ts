import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FusekiService } from './fuseki.service';

@Module({
  imports: [ConfigModule],
  providers: [FusekiService],
  exports: [FusekiService],
})
export class FusekiModule {}
