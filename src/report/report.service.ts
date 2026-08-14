import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { and, dateRange } from '../common/query.util';
import { PNL_NATURES, withRemaining } from '../common/money.util';
import { buildSchedule, reconcile } from '../common/loan-schedule';
import type { InterestMethod } from '../common/loan-schedule';

/** Chỉ giao dịch vào lãi/lỗ — bỏ financing (vay, trả gốc, cho vay, thu hồi). */
const PNL_ONLY = { nature: { in: PNL_NATURES } };

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  private range(from?: string, to?: string) {
    const r = dateRange(from, to);
    return r ? { date: r } : undefined;
  }

  /**
   * Ba khối tách bạch:
   *  - cash    : dòng tiền thật, gồm cả vay/trả nợ  -> số dư khớp tiền trong túi
   *  - business: lãi/lỗ của các công việc
   *  - personal: chi tiêu hằng ngày, không thuộc công việc nào
   */
  async overview(from?: string, to?: string) {
    const period = this.range(from, to);

    const [cashPeriod, cashAll, pnl, debts] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['kind'],
        where: and(period),
        _sum: { amount: true },
      }),
      this.prisma.transaction.groupBy({ by: ['kind'], _sum: { amount: true } }),
      this.prisma.transaction.groupBy({
        by: ['kind'],
        where: and(period, PNL_ONLY),
        _sum: { amount: true },
      }),
      this.prisma.debt.findMany({
        select: {
          direction: true,
          principal: true,
          dueDate: true,
          payments: { select: { principalAmount: true, interestAmount: true } },
        },
      }),
    ]);

    const [businessPnl, personalPnl] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['kind'],
        where: and(period, PNL_ONLY, { NOT: { projectId: null } }),
        _sum: { amount: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['kind'],
        where: and(period, PNL_ONLY, { projectId: null }),
        _sum: { amount: true },
      }),
    ]);

    const sum = (rows: { kind: string; _sum: { amount: number | null } }[], kind: string) =>
      rows.find((r) => r.kind === kind)?._sum.amount ?? 0;
    const block = (rows: { kind: string; _sum: { amount: number | null } }[]) => {
      const income = sum(rows, 'income');
      const expense = sum(rows, 'expense');
      return { income, expense, net: income - expense };
    };

    const debtTotals = debts.map((d) => withRemaining(d)).reduce(
      (acc, d) => {
        if (d.remaining > 0) {
          acc[d.direction === 'i_owe' ? 'iOwe' : 'owesMe'] += d.remaining;
          if (d.status === 'overdue') acc.overdue += d.remaining;
        }
        acc.interestPaid += d.interestPaid;
        return acc;
      },
      { iOwe: 0, owesMe: 0, overdue: 0, interestPaid: 0 },
    );

    const balance = sum(cashAll, 'income') - sum(cashAll, 'expense');

    return {
      cash: { ...block(cashPeriod), balance },
      pnl: block(pnl),
      business: block(businessPnl),
      personal: block(personalPnl),
      debts: debtTotals,
      /** Tiền thật có, trừ nợ phải trả, cộng nợ phải thu. */
      netWorth: balance - debtTotals.iOwe + debtTotals.owesMe,
    };
  }

  async byCategory(from?: string, to?: string) {
    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId', 'kind'],
      where: and(this.range(from, to), PNL_ONLY),
      _sum: { amount: true },
    });
    const categories = await this.prisma.category.findMany();
    return rows.map((r) => ({
      categoryId: r.categoryId,
      name: categories.find((c) => c.id === r.categoryId)?.name ?? '(đã xoá)',
      kind: r.kind,
      total: r._sum.amount ?? 0,
    }));
  }

  /** Lãi/lỗ theo công việc — không tính tiền vay và trả gốc. */
  async byProject(from?: string, to?: string) {
    const rows = await this.prisma.transaction.groupBy({
      by: ['projectId', 'kind'],
      where: and(this.range(from, to), PNL_ONLY),
      _sum: { amount: true },
    });
    const projects = await this.prisma.project.findMany();
    const ids = [...new Set(rows.map((r) => r.projectId))];
    return ids.map((id) => {
      const pick = (kind: string) =>
        rows.find((r) => r.projectId === id && r.kind === kind)?._sum.amount ?? 0;
      const income = pick('income');
      const expense = pick('expense');
      return {
        projectId: id,
        name:
          id === null
            ? '(chi tiêu cá nhân)'
            : (projects.find((p) => p.id === id)?.name ?? '(đã xoá)'),
        income,
        expense,
        profit: income - expense,
      };
    });
  }

  /**
   * Tổng hợp các khoản vay có lịch trả: mỗi tháng phải trả bao nhiêu,
   * kỳ tới rơi vào ngày nào, đang quá hạn bao nhiêu.
   */
  async loans() {
    const debts = await this.prisma.debt.findMany({
      where: { NOT: { interestMethod: 'none' } },
      include: { person: { select: { name: true } }, payments: true },
    });

    const now = new Date();
    const items = debts.map((d) => {
      const schedule = buildSchedule(
        {
          principal: d.principal,
          startDate: d.date,
          termMonths: d.termMonths,
          paymentDay: d.paymentDay,
          interestMethod: d.interestMethod as InterestMethod,
          interestRate: d.interestRate,
          fixedInterestAmount: d.fixedInterestAmount,
          contractPayment: d.contractPayment,
          contractLastPayment: d.contractLastPayment,
        },
        now,
      );
      const { summary } = reconcile(schedule, d.payments, now);
      const remaining =
        d.principal - d.payments.reduce((s, p) => s + p.principalAmount, 0);
      return {
        debtId: d.id,
        lender: d.person.name,
        loanType: d.loanType,
        interestMethod: d.interestMethod,
        principal: d.principal,
        remaining,
        ...summary,
      };
    });

    return {
      items: items.sort((a, b) => b.overdueAmount - a.overdueAmount),
      totals: items.reduce(
        (acc, i) => {
          acc.monthlyPayment += i.nextPayment;
          acc.overdue += i.overdueAmount;
          acc.remaining += i.remaining;
          acc.interestLeft += i.totalInterest;
          return acc;
        },
        { monthlyPayment: 0, overdue: 0, remaining: 0, interestLeft: 0 },
      ),
    };
  }

  /** Dư nợ gom theo người, hai chiều. */
  async byPerson() {
    const people = await this.prisma.person.findMany({
      include: {
        debts: {
          select: {
            direction: true,
            principal: true,
            dueDate: true,
            payments: { select: { principalAmount: true, interestAmount: true } },
          },
        },
      },
    });
    return people
      .map((p) => {
        const totals = p.debts.map((d) => withRemaining(d)).reduce(
          (acc, d) => {
            if (d.remaining > 0)
              acc[d.direction === 'i_owe' ? 'iOwe' : 'owesMe'] += d.remaining;
            return acc;
          },
          { iOwe: 0, owesMe: 0 },
        );
        return { personId: p.id, name: p.name, ...totals, debtCount: p.debts.length };
      })
      .filter((p) => p.iOwe > 0 || p.owesMe > 0)
      .sort((a, b) => b.iOwe + b.owesMe - (a.iOwe + a.owesMe));
  }

  /** Dòng tiền theo tháng, cho biểu đồ. */
  async monthly(from?: string, to?: string) {
    const rows = await this.prisma.transaction.findMany({
      where: and(this.range(from, to)),
      select: { date: true, kind: true, amount: true, nature: true },
    });
    const map = new Map<
      string,
      { month: string; income: number; expense: number; pnlNet: number }
    >();
    for (const r of rows) {
      const month = r.date.toISOString().slice(0, 7);
      const entry = map.get(month) ?? { month, income: 0, expense: 0, pnlNet: 0 };
      entry[r.kind === 'income' ? 'income' : 'expense'] += r.amount;
      if (PNL_NATURES.includes(r.nature as any))
        entry.pnlNet += r.kind === 'income' ? r.amount : -r.amount;
      map.set(month, entry);
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  }
}
