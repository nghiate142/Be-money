import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  amountRange,
  and,
  dateRange,
  idFilter,
  parseSort,
} from '../common/query.util';
import { PNL_NATURES } from '../common/money.util';
import { QueryTransactionDto } from './dto/query-transaction.dto';

/** Giá trị đã chuẩn hoá: `amount` luôn là VND, `originalAmount` là tiền đã trả. */
export type TransactionData = {
  date: Date;
  amount: number;
  currency: string;
  originalAmount: number;
  rate: number;
  kind: string;
  categoryId: number;
  projectId?: number | null;
  note?: string | null;
};

const SORTABLE = ['date', 'amount', 'createdAt'] as const;
const WITH_REFS = {
  category: { select: { id: true, name: true, kind: true, code: true } },
  project: { select: { id: true, name: true } },
  debt: { select: { id: true, direction: true, person: { select: { name: true } } } },
  debtPayment: { select: { id: true, debtId: true } },
};

@Injectable()
export class TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private where(dto: QueryTransactionDto) {
    const date = dateRange(dto.from, dto.to);
    const amount = amountRange(dto.amountMin, dto.amountMax);
    return and(
      dto.q ? { note: { contains: dto.q } } : undefined,
      date ? { date } : undefined,
      amount ? { amount } : undefined,
      dto.kind ? { kind: dto.kind } : undefined,
      dto.nature ? { nature: dto.nature } : undefined,
      dto.scope === 'project'
        ? { NOT: { projectId: null } }
        : dto.scope === 'personal'
          ? { projectId: null }
          : undefined,
      idFilter('categoryId', dto.categoryId),
      idFilter('projectId', dto.projectId),
    );
  }

  async list(dto: QueryTransactionDto) {
    const where = this.where(dto);
    const [items, total, sums] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: WITH_REFS,
        orderBy: parseSort(dto.sort, SORTABLE, { date: 'desc' }),
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.groupBy({
        by: ['kind', 'nature'],
        where,
        _sum: { amount: true },
      }),
    ]);

    const sum = (kind: string, natures?: string[]) =>
      sums
        .filter((s) => s.kind === kind && (!natures || natures.includes(s.nature)))
        .reduce((acc, s) => acc + (s._sum.amount ?? 0), 0);

    return {
      items,
      total,
      totals: {
        // Dòng tiền: mọi bản chất.
        income: sum('income'),
        expense: sum('expense'),
        // Lãi/lỗ: bỏ financing (vay, trả gốc) vì không phải thu nhập/chi phí thật.
        pnlIncome: sum('income', PNL_NATURES),
        pnlExpense: sum('expense', PNL_NATURES),
      },
    };
  }

  findOne(id: number) {
    return this.prisma.transaction.findUnique({
      where: { id },
      include: WITH_REFS,
    });
  }

  /** `data` do service dựng sẵn, đã quy đổi ra VND. */
  create(data: TransactionData) {
    return this.prisma.transaction.create({
      data: { ...data, nature: 'operating' },
      include: WITH_REFS,
    });
  }

  update(id: number, data: Partial<TransactionData>) {
    return this.prisma.transaction.update({
      where: { id },
      data,
      include: WITH_REFS,
    });
  }

  remove(id: number) {
    return this.prisma.transaction.delete({ where: { id } });
  }

  /** Dùng cho export CSV — không phân trang. */
  findAllForExport(dto: QueryTransactionDto) {
    return this.prisma.transaction.findMany({
      where: this.where(dto),
      include: WITH_REFS,
      orderBy: parseSort(dto.sort, SORTABLE, { date: 'desc' }),
    });
  }
}
