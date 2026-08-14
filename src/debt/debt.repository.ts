import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { and, dateRange, idFilter } from '../common/query.util';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { QueryDebtDto } from './dto/query-debt.dto';
import { CreateDebtPaymentDto } from './dto/create-debt-payment.dto';

const WITH_REFS = {
  person: { select: { id: true, name: true, phone: true } },
  project: { select: { id: true, name: true } },
  payments: { orderBy: { date: 'desc' as const } },
};

/**
 * Mỗi sự kiện của khoản nợ ứng với một giao dịch tiền.
 * `nature: financing` = không vào lãi/lỗ; `interest` = có vào lãi/lỗ.
 */
const LEDGER = {
  i_owe: {
    open: { code: 'DEBT_BORROW', kind: 'income', nature: 'financing', label: 'Vay nợ' },
    repay: { code: 'DEBT_REPAY', kind: 'expense', nature: 'financing', label: 'Trả nợ gốc' },
    interest: { code: 'DEBT_INTEREST', kind: 'expense', nature: 'interest', label: 'Lãi vay' },
  },
  owes_me: {
    open: { code: 'DEBT_LEND', kind: 'expense', nature: 'financing', label: 'Cho vay' },
    repay: { code: 'DEBT_COLLECT', kind: 'income', nature: 'financing', label: 'Thu hồi nợ' },
    interest: null,
  },
} as const;

type Event = { code: string; kind: string; nature: string; label: string };

@Injectable()
export class DebtRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- đọc ----------

  /** Lọc phần làm được ở DB; `remaining`/`status` tính sau nên không lọc ở đây. */
  findMatching(dto: QueryDebtDto) {
    const date = dateRange(dto.from, dto.to);
    const due = dateRange(dto.dueFrom, dto.dueTo);
    return this.prisma.debt.findMany({
      where: and(
        dto.q
          ? {
              OR: [
                { person: { name: { contains: dto.q } } },
                { note: { contains: dto.q } },
              ],
            }
          : undefined,
        dto.direction ? { direction: dto.direction } : undefined,
        date ? { date } : undefined,
        due ? { dueDate: due } : undefined,
        idFilter('personId', dto.personId),
        idFilter('projectId', dto.projectId),
      ),
      include: WITH_REFS,
    });
  }

  findOne(id: number) {
    return this.prisma.debt.findUnique({ where: { id }, include: WITH_REFS });
  }

  findPayment(id: number) {
    return this.prisma.debtPayment.findUnique({ where: { id } });
  }

  countPayments(debtId: number) {
    return this.prisma.debtPayment.count({ where: { debtId } });
  }

  // ---------- ghi ----------

  /** Lập khoản nợ và giao dịch nhận/đưa tiền gốc trong cùng một transaction DB. */
  async create(dto: CreateDebtDto) {
    return this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.create({ data: this.toData(dto) as any });
      await this.syncPrincipalTransaction(tx, debt);
      return tx.debt.findUniqueOrThrow({ where: { id: debt.id }, include: WITH_REFS });
    });
  }

  /** Sửa khoản nợ thì giao dịch gốc phải đổi theo, nếu không sổ sẽ lệch. */
  async update(id: number, dto: UpdateDebtDto) {
    return this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.update({ where: { id }, data: this.toData(dto) });
      await this.syncPrincipalTransaction(tx, debt);
      return tx.debt.findUniqueOrThrow({ where: { id }, include: WITH_REFS });
    });
  }

  /**
   * Đưa giao dịch tiền gốc về đúng trạng thái của khoản nợ:
   * `affectsBalance` bật thì phải có đúng một giao dịch khớp số liệu,
   * tắt thì không được có giao dịch nào (khoản vay cũ, tiền đã tiêu hết).
   */
  private async syncPrincipalTransaction(tx: any, debt: any) {
    const existing = await tx.transaction.findFirst({ where: { debtId: debt.id } });

    if (!debt.affectsBalance) {
      if (existing) await tx.transaction.delete({ where: { id: existing.id } });
      return;
    }

    const event: Event = LEDGER[debt.direction as 'i_owe'].open;
    const data = {
      date: debt.date,
      amount: debt.principal,
      projectId: debt.projectId,
    };

    if (existing) {
      await tx.transaction.update({ where: { id: existing.id }, data });
      return;
    }

    const person = await tx.person.findUniqueOrThrow({ where: { id: debt.personId } });
    await tx.transaction.create({
      data: {
        ...data,
        kind: event.kind,
        nature: event.nature,
        note: `${event.label} — ${person.name}`,
        categoryId: await this.categoryId(tx, event),
        debtId: debt.id,
      },
    });
  }

  /** Chỉ dùng khi khoản nợ chưa có lần trả nào; giao dịch gốc xoá theo cascade. */
  remove(id: number) {
    return this.prisma.debt.delete({ where: { id } });
  }

  /** Ghi một lần trả: sinh giao dịch gốc, và giao dịch lãi nếu có. */
  async addPayment(debtId: number, dto: CreateDebtPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findUniqueOrThrow({
        where: { id: debtId },
        include: { person: true },
      });
      const ledger = LEDGER[debt.direction as 'i_owe'];

      const payment = await tx.debtPayment.create({
        data: {
          debtId,
          date: new Date(dto.date),
          principalAmount: dto.principalAmount,
          interestAmount: dto.interestAmount ?? 0,
          note: dto.note,
        },
      });

      const rows: { event: Event; amount: number }[] = [];
      if (payment.principalAmount > 0)
        rows.push({ event: ledger.repay, amount: payment.principalAmount });
      if (payment.interestAmount > 0 && ledger.interest)
        rows.push({ event: ledger.interest, amount: payment.interestAmount });

      for (const { event, amount } of rows) {
        await tx.transaction.create({
          data: {
            date: payment.date,
            amount,
            kind: event.kind,
            nature: event.nature,
            note: `${event.label} — ${debt.person.name}`,
            categoryId: await this.categoryId(tx, event),
            projectId: debt.projectId,
            debtPaymentId: payment.id,
          },
        });
      }

      return payment;
    });
  }

  /** Giao dịch của lần trả này xoá theo cascade. */
  removePayment(id: number) {
    return this.prisma.debtPayment.delete({ where: { id } });
  }

  private async categoryId(tx: any, event: Event): Promise<number> {
    const category = await tx.category.findUniqueOrThrow({
      where: { code: event.code },
    });
    return category.id;
  }

  private toData(dto: CreateDebtDto | UpdateDebtDto) {
    return {
      ...dto,
      ...(dto.date ? { date: new Date(dto.date) } : {}),
      ...(dto.dueDate !== undefined
        ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
        : {}),
    };
  }
}
