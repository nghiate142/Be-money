import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Cắt về 00:00 UTC để mỗi ngày chỉ có một bản ghi tỷ giá. */
export const atDay = (date: string | Date) =>
  new Date(`${new Date(date).toISOString().slice(0, 10)}T00:00:00.000Z`);

@Injectable()
export class ExchangeRateRepository {
  constructor(private readonly prisma: PrismaService) {}

  currencies() {
    return this.prisma.currency.findMany({ orderBy: { code: 'asc' } });
  }

  findCurrency(code: string) {
    return this.prisma.currency.findUnique({ where: { code } });
  }

  findRate(currencyCode: string, date: Date) {
    return this.prisma.exchangeRate.findUnique({
      where: { currencyCode_date: { currencyCode, date } },
    });
  }

  /** Tỷ giá gần nhất trước hoặc bằng ngày cần dùng — để dùng khi API không gọi được. */
  findNearest(currencyCode: string, date: Date) {
    return this.prisma.exchangeRate.findFirst({
      where: { currencyCode, date: { lte: date } },
      orderBy: { date: 'desc' },
    });
  }

  save(currencyCode: string, date: Date, rate: number, source: string) {
    return this.prisma.exchangeRate.upsert({
      where: { currencyCode_date: { currencyCode, date } },
      update: { rate, source },
      create: { currencyCode, date, rate, source },
    });
  }

  list(currencyCode?: string, limit = 100) {
    return this.prisma.exchangeRate.findMany({
      where: currencyCode ? { currencyCode } : undefined,
      orderBy: [{ date: 'desc' }, { currencyCode: 'asc' }],
      take: limit,
    });
  }
}
