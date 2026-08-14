import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { atDay, ExchangeRateRepository } from './exchange-rate.repository';

/** Miễn phí, không cần API key, trả tỷ giá 1 USD = ? các loại tiền khác. */
const API_URL = (base: string) => `https://open.er-api.com/v6/latest/${base}`;
const TIMEOUT_MS = 8000;

export type RateResult = {
  currency: string;
  date: string;
  rate: number;
  /** api = vừa gọi mạng, cache = đã lưu sẵn, nearest = lấy tạm ngày gần nhất, manual = bạn tự nhập */
  source: 'api' | 'cache' | 'nearest' | 'manual';
  stale?: boolean;
};

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  constructor(private readonly repo: ExchangeRateRepository) {}

  currencies() {
    return this.repo.currencies();
  }

  list(currency?: string) {
    return this.repo.list(currency);
  }

  /**
   * Tỷ giá 1 đơn vị `code` = ? VND cho một ngày.
   * Ưu tiên bản đã lưu, chưa có thì gọi API rồi cache lại.
   * Mất mạng thì lùi về tỷ giá gần nhất đã lưu và đánh dấu `stale`.
   */
  async resolve(code: string, date?: string): Promise<RateResult> {
    const currency = await this.repo.findCurrency(code);
    if (!currency) throw new BadRequestException(`Không hỗ trợ loại tiền ${code}`);

    const day = atDay(date ?? new Date());
    const iso = day.toISOString().slice(0, 10);

    if (code === 'VND') return { currency: code, date: iso, rate: 1, source: 'cache' };

    const cached = await this.repo.findRate(code, day);
    if (cached)
      return {
        currency: code,
        date: iso,
        rate: cached.rate,
        source: cached.source === 'manual' ? 'manual' : 'cache',
      };

    const fetched = await this.fetchFromApi(code);
    if (fetched !== null) {
      await this.repo.save(code, day, fetched, 'api');
      return { currency: code, date: iso, rate: fetched, source: 'api' };
    }

    const nearest = await this.repo.findNearest(code, day);
    if (nearest)
      return {
        currency: code,
        date: iso,
        rate: nearest.rate,
        source: 'nearest',
        stale: true,
      };

    throw new BadRequestException(
      `Không lấy được tỷ giá ${code}/VND (không gọi được mạng và chưa có tỷ giá nào đã lưu). Nhập tỷ giá thủ công.`,
    );
  }

  /** Ghi đè tỷ giá bằng tay — dùng khi không có mạng hoặc muốn dùng tỷ giá ngân hàng. */
  async setManual(code: string, date: string, rate: number) {
    if (code === 'VND') throw new BadRequestException('VND không cần tỷ giá');
    if (!(await this.repo.findCurrency(code)))
      throw new BadRequestException(`Không hỗ trợ loại tiền ${code}`);
    if (rate <= 0) throw new BadRequestException('Tỷ giá phải lớn hơn 0');
    return this.repo.save(code, atDay(date), rate, 'manual');
  }

  /** Trả null nếu mạng lỗi — người gọi tự quyết định lùi về phương án khác. */
  private async fetchFromApi(code: string): Promise<number | null> {
    try {
      const res = await fetch(API_URL(code), {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { rates?: Record<string, number> };
      const rate = body.rates?.VND;
      return typeof rate === 'number' && rate > 0 ? rate : null;
    } catch (e) {
      this.logger.warn(`Không gọi được API tỷ giá ${code}: ${(e as Error).message}`);
      return null;
    }
  }
}
