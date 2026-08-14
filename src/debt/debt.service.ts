import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DebtRepository } from './debt.repository';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { QueryDebtDto } from './dto/query-debt.dto';
import { CreateDebtPaymentDto } from './dto/create-debt-payment.dto';
import { paginate } from '../common/query.util';
import { withRemaining } from '../common/money.util';
import { buildSchedule, DEFAULT_METHOD, reconcile } from '../common/loan-schedule';
import type { InterestMethod, LoanType } from '../common/loan-schedule';

const SORTABLE = ['dueDate', 'date', 'remaining', 'principal', 'paid'] as const;

@Injectable()
export class DebtService {
  constructor(private readonly repo: DebtRepository) {}

  /**
   * `remaining` và `status` là giá trị tính toán nên lọc/sắp xếp theo chúng
   * phải làm sau khi load.
   * ponytail: đủ cho vài nghìn khoản nợ; vượt ngưỡng thì chuyển sang raw SQL
   * có GROUP BY + HAVING.
   */
  async findAll(dto: QueryDebtDto) {
    let rows = (await this.repo.findMatching(dto)).map((d) => withRemaining(d));

    if (dto.status) rows = rows.filter((d) => d.status === dto.status);
    if (dto.amountMin !== undefined)
      rows = rows.filter((d) => d.remaining >= dto.amountMin!);
    if (dto.amountMax !== undefined)
      rows = rows.filter((d) => d.remaining <= dto.amountMax!);

    const [field, dir = 'asc'] = (dto.sort ?? 'dueDate:asc').split(':');
    const key = (SORTABLE as readonly string[]).includes(field) ? field : 'dueDate';
    const sign = dir === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      const x = (a as any)[key];
      const y = (b as any)[key];
      if (x == null) return 1; // chưa có hạn thì xuống cuối
      if (y == null) return -1;
      return (Number(x) - Number(y)) * sign;
    });

    const totals = rows.reduce(
      (acc, d) => {
        acc[d.direction === 'i_owe' ? 'iOwe' : 'owesMe'] += d.remaining;
        acc.interestPaid += d.interestPaid;
        return acc;
      },
      { iOwe: 0, owesMe: 0, interestPaid: 0 },
    );

    return {
      ...paginate(
        rows.slice(dto.skip, dto.skip + dto.limit),
        rows.length,
        dto.page,
        dto.limit,
      ),
      totals,
    };
  }

  async findOne(id: number) {
    const found = await this.repo.findOne(id);
    if (!found) throw new NotFoundException('Không tìm thấy khoản nợ');
    return withRemaining(found);
  }

  create(dto: CreateDebtDto) {
    return this.repo.create({ ...dto, ...this.withLoanDefaults(dto) });
  }

  /** Lịch trả nợ dự kiến, đối chiếu với các lần đã trả thực tế. */
  async schedule(id: number) {
    const debt = await this.findOne(id);
    const schedule = buildSchedule({
      principal: debt.principal,
      startDate: debt.date,
      termMonths: debt.termMonths,
      paymentDay: debt.paymentDay,
      interestMethod: debt.interestMethod as InterestMethod,
      interestRate: debt.interestRate,
      fixedInterestAmount: debt.fixedInterestAmount,
      contractPayment: debt.contractPayment,
      contractLastPayment: debt.contractLastPayment,
    });
    if (!schedule.length)
      throw new BadRequestException(
        'Khoản nợ này không có công thức lãi nên không sinh được lịch trả. ' +
          'Chọn cách tính lãi ở phần sửa khoản nợ.',
      );
    return reconcile(schedule, debt.payments, new Date());
  }

  /**
   * Suy ra cách tính lãi từ loại vay khi client không chỉ định, và chặn các
   * tổ hợp vô nghĩa (thiếu lãi suất, thiếu kỳ hạn…).
   */
  private withLoanDefaults(terms: {
    direction?: string | null;
    loanType?: string | null;
    interestMethod?: string | null;
    interestRate?: number | null;
    fixedInterestAmount?: number | null;
    contractPayment?: number | null;
    termMonths?: number | null;
  }) {
    const loanType = (terms.loanType ?? 'personal') as LoanType;
    const method = (terms.interestMethod ?? DEFAULT_METHOD[loanType]) as InterestMethod;

    if (loanType !== 'personal' && terms.direction === 'owes_me')
      throw new BadRequestException(
        'Vay tín chấp / thế chấp / thấu chi chỉ áp dụng cho khoản mình đi vay',
      );

    if (['flat', 'declining', 'annuity'].includes(method)) {
      if (!terms.interestRate)
        throw new BadRequestException('Cách tính lãi này cần lãi suất %/tháng');
      if (!terms.termMonths)
        throw new BadRequestException('Cách tính lãi này cần số kỳ trả');
    }
    if (method === 'fixed' && !terms.fixedInterestAmount)
      throw new BadRequestException('Chọn lãi cố định thì phải nhập số tiền lãi mỗi tháng');

    if (method === 'contract') {
      if (!terms.contractPayment)
        throw new BadRequestException(
          'Chọn "theo hợp đồng" thì phải nhập số tiền phải trả mỗi kỳ',
        );
      if (!terms.termMonths)
        throw new BadRequestException('Chọn "theo hợp đồng" thì phải nhập số kỳ trả');
    }

    return { loanType, interestMethod: method };
  }

  async update(id: number, dto: UpdateDebtDto) {
    const current = await this.findOne(id);
    if (dto.direction && dto.direction !== current.direction)
      throw new BadRequestException(
        'Không đổi được chiều nợ sau khi đã lập. Xoá và tạo lại khoản nợ mới.',
      );
    if (dto.principal !== undefined && dto.principal < current.paid)
      throw new BadRequestException(
        `Gốc mới (${dto.principal}) nhỏ hơn số gốc đã trả (${current.paid})`,
      );
    // Validate trên giá trị sau khi ghép, nhưng chỉ ghi xuống DB các field client gửi.
    const resolved = this.withLoanDefaults({
      direction: dto.direction ?? current.direction,
      loanType: dto.loanType ?? current.loanType,
      interestMethod: dto.interestMethod ?? current.interestMethod,
      interestRate: dto.interestRate ?? current.interestRate,
      fixedInterestAmount: dto.fixedInterestAmount ?? current.fixedInterestAmount,
      contractPayment: dto.contractPayment ?? current.contractPayment,
      termMonths: dto.termMonths ?? current.termMonths,
    });
    return this.repo.update(id, { ...dto, ...resolved });
  }

  /**
   * Khoản nợ đã phát sinh trả thì không xoá — chỉ tất toán bằng cách trả hết,
   * lúc đó `status` tự chuyển sang `paid`. Chỉ cho xoá khi nhập nhầm (chưa trả gì).
   */
  async remove(id: number) {
    await this.findOne(id);
    const payments = await this.repo.countPayments(id);
    if (payments)
      throw new BadRequestException(
        `Khoản nợ đã có ${payments} lần trả nên không xoá được. ` +
          'Trả hết để chuyển sang trạng thái "đã trả", hoặc xoá các lần trả trước.',
      );
    return this.repo.remove(id);
  }

  async addPayment(debtId: number, dto: CreateDebtPaymentDto) {
    const debt = await this.findOne(debtId);
    const interest = dto.interestAmount ?? 0;

    if (dto.principalAmount === 0 && interest === 0)
      throw new BadRequestException('Phải nhập tiền gốc hoặc tiền lãi');

    if (dto.principalAmount > debt.remaining)
      throw new BadRequestException(
        `Tiền gốc trả (${dto.principalAmount}) vượt quá số còn lại (${debt.remaining})`,
      );

    if (interest > 0 && debt.direction === 'owes_me')
      throw new BadRequestException(
        'Khoản cho vay không tính lãi, chỉ ghi được tiền gốc',
      );

    await this.repo.addPayment(debtId, dto);
    return this.findOne(debtId);
  }

  async removePayment(debtId: number, paymentId: number) {
    const payment = await this.repo.findPayment(paymentId);
    if (!payment || payment.debtId !== debtId)
      throw new NotFoundException('Không tìm thấy lần trả nợ này');
    await this.repo.removePayment(paymentId);
    return this.findOne(debtId);
  }
}
