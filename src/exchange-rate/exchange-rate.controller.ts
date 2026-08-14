import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';

@Controller('exchange-rates')
export class ExchangeRateController {
  constructor(private readonly service: ExchangeRateService) {}

  /** Danh sách loại tiền được phép ghi. */
  @Get('currencies')
  currencies() {
    return this.service.currencies();
  }

  /** Tỷ giá dùng cho một ngày — tự gọi API và cache nếu chưa có. */
  @Get('resolve')
  resolve(@Query('currency') currency: string, @Query('date') date?: string) {
    return this.service.resolve(currency, date);
  }

  @Get()
  list(@Query('currency') currency?: string) {
    return this.service.list(currency);
  }

  @Post()
  setManual(@Body() dto: CreateExchangeRateDto) {
    return this.service.setManual(dto.currency, dto.date, dto.rate);
  }
}
