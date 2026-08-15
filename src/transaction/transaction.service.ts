import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionRepository } from './transaction.repository';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { PrismaService } from '../prisma/prisma.service';
import { toVnd } from '../common/money.util';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';

@Injectable()
export class TransactionService {
  constructor(
    private readonly repo: TransactionRepository,
    private readonly prisma: PrismaService,
    private readonly rates: ExchangeRateService,
  ) {}

  async findAll(dto: QueryTransactionDto) {
    const { items, total, totals } = await this.repo.list(dto);
    return { items, total, page: dto.page, limit: dto.limit, totals };
  }

  async findOne(id: number) {
    const found = await this.repo.findOne(id);
    if (!found) throw new NotFoundException('Không tìm thấy giao dịch');
    return found;
  }

  async create(dto: CreateTransactionDto) {
    await this.assertCategoryUsable(dto.categoryId, dto.kind);
    const { amount, currency, originalAmount, rate } = await this.convert(
      dto.amount,
      dto.currency,
      dto.date,
      dto.rate,
      dto.fee,
    );
    return this.repo.create({
      date: new Date(dto.date),
      amount,
      fee: dto.fee ?? 0,
      currency,
      originalAmount,
      rate,
      kind: dto.kind,
      categoryId: dto.categoryId,
      projectId: dto.projectId ?? null,
      personId: dto.personId ?? null,
      note: dto.note ?? null,
    });
  }

  async update(id: number, dto: UpdateTransactionDto) {
    const current = await this.findOne(id);
    this.assertNotFromDebt(current);
    await this.assertCategoryUsable(
      dto.categoryId ?? current.categoryId,
      dto.kind ?? current.kind,
    );

    // Đổi số tiền, loại tiền, tỷ giá hay ngày đều phải quy đổi lại.
    const touchesMoney =
      dto.amount !== undefined ||
      dto.currency !== undefined ||
      dto.rate !== undefined ||
      dto.date !== undefined ||
      dto.fee !== undefined;

    const money = touchesMoney
      ? {
          ...(await this.convert(
            dto.amount ?? current.originalAmount,
            dto.currency ?? current.currency,
            dto.date ?? current.date.toISOString(),
            dto.rate ?? (dto.currency === undefined ? current.rate : undefined),
            dto.fee ?? current.fee,
          )),
          fee: dto.fee ?? current.fee,
        }
      : undefined;

    return this.repo.update(id, {
      ...(dto.date ? { date: new Date(dto.date) } : {}),
      ...(dto.kind ? { kind: dto.kind } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
      ...(dto.personId !== undefined ? { personId: dto.personId } : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
      ...(money ?? {}),
    });
  }

  /**
   * Quy đổi về VND. Giao dịch VND thì tỷ giá 1, ngoại tệ thì lấy tỷ giá của
   * đúng ngày giao dịch (gọi API rồi cache), trừ khi client chốt sẵn `rate`.
   * `fee` là phí (VND) cộng thêm vào số vào sổ.
   */
  private async convert(
    original: number,
    code: string | undefined,
    date: string,
    rate?: number,
    fee = 0,
  ) {
    const currency = (code ?? 'VND').toUpperCase();
    if (currency === 'VND')
      return {
        amount: original + fee,
        currency,
        originalAmount: original,
        rate: 1,
      };

    const meta = await this.prisma.currency.findUnique({ where: { code: currency } });
    if (!meta) throw new BadRequestException(`Không hỗ trợ loại tiền ${currency}`);

    const used = rate ?? (await this.rates.resolve(currency, date)).rate;
    return {
      amount: toVnd(original, meta.decimals, used) + fee,
      currency,
      originalAmount: original,
      rate: used,
    };
  }

  async remove(id: number) {
    const current = await this.findOne(id);
    this.assertNotFromDebt(current);
    return this.repo.remove(id);
  }

  export(dto: QueryTransactionDto) {
    return this.repo.findAllForExport(dto);
  }

  /**
   * Giao dịch sinh từ khoản nợ chỉ được sửa qua chính khoản nợ đó,
   * nếu không số dư nợ và sổ tiền sẽ lệch nhau.
   */
  private assertNotFromDebt(t: { debtId: number | null; debtPaymentId: number | null }) {
    if (t.debtId || t.debtPaymentId)
      throw new BadRequestException(
        'Giao dịch này sinh từ khoản nợ. Sửa hoặc xoá ở tab Nợ.',
      );
  }

  /** Chặn gán sai chiều tiền, và chặn dùng danh mục hệ thống cho giao dịch thường. */
  private async assertCategoryUsable(categoryId: number, kind: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new BadRequestException('Danh mục không tồn tại');
    if (category.code)
      throw new BadRequestException(
        `"${category.name}" là danh mục hệ thống, chỉ dùng cho giao dịch sinh từ khoản nợ`,
      );
    if (category.kind !== kind)
      throw new BadRequestException(
        `Danh mục "${category.name}" thuộc loại ${category.kind}, không dùng cho giao dịch ${kind}`,
      );
  }
}
