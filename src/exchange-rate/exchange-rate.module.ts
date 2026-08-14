import { Module } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';
import { ExchangeRateController } from './exchange-rate.controller';
import { ExchangeRateRepository } from './exchange-rate.repository';

@Module({
  controllers: [ExchangeRateController],
  providers: [ExchangeRateService, ExchangeRateRepository],
  exports: [ExchangeRateService, ExchangeRateRepository],
})
export class ExchangeRateModule {}
