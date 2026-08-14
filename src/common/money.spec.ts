import { PNL_NATURES, withRemaining } from './money.util';
import { amountRange, dateRange, endOfDay, idFilter, parseSort } from './query.util';

const pay = (principalAmount: number, interestAmount = 0) => ({
  principalAmount,
  interestAmount,
});

describe('khoản nợ', () => {
  const NOW = new Date('2026-08-14T00:00:00Z');
  const debt = (
    principal: number,
    dueDate: Date | null,
    ...payments: { principalAmount: number; interestAmount: number }[]
  ) => withRemaining({ principal, dueDate, payments }, NOW);

  it('chưa trả thì còn nguyên gốc', () => {
    expect(debt(10_000_000, null)).toMatchObject({
      paid: 0,
      remaining: 10_000_000,
      status: 'active',
    });
  });

  it('chỉ tiền gốc mới làm giảm dư nợ, tiền lãi thì không', () => {
    expect(debt(10_000_000, null, pay(4_000_000, 500_000))).toMatchObject({
      paid: 4_000_000,
      interestPaid: 500_000,
      remaining: 6_000_000,
      status: 'active',
    });
  });

  it('trả hết gốc thì chuyển trạng thái đã trả', () => {
    expect(debt(5_000_000, null, pay(2_000_000), pay(3_000_000))).toMatchObject({
      remaining: 0,
      status: 'paid',
    });
  });

  it('quá hạn mà chưa trả hết thì là overdue', () => {
    expect(debt(5_000_000, new Date('2026-06-01')).status).toBe('overdue');
    expect(debt(5_000_000, new Date('2026-12-01')).status).toBe('active');
  });

  it('quá hạn nhưng đã trả hết vẫn là đã trả', () => {
    expect(debt(5_000_000, new Date('2026-06-01'), pay(5_000_000)).status).toBe('paid');
  });

  it('vay và trả gốc không được tính vào lãi/lỗ', () => {
    expect(PNL_NATURES).toEqual(['operating', 'interest']);
    expect(PNL_NATURES).not.toContain('financing');
  });
});

describe('bộ lọc', () => {
  it('to bao gồm cả ngày đó', () => {
    expect(endOfDay('2026-07-31').toISOString()).toBe('2026-07-31T23:59:59.999Z');
  });

  it('không có from/to thì không sinh điều kiện', () => {
    expect(dateRange()).toBeUndefined();
    expect(amountRange()).toBeUndefined();
  });

  it('idFilter phân biệt danh sách id và "không thuộc mục nào"', () => {
    expect(idFilter('projectId', [1, 2])).toEqual({ projectId: { in: [1, 2] } });
    expect(idFilter('projectId', [null])).toEqual({ projectId: null });
    expect(idFilter('projectId', [1, null])).toEqual({
      OR: [{ projectId: { in: [1] } }, { projectId: null }],
    });
    expect(idFilter('projectId', undefined)).toBeUndefined();
  });

  it('parseSort chỉ nhận field trong whitelist', () => {
    const allowed = ['date', 'amount'] as const;
    const fallback = { date: 'desc' as const };
    expect(parseSort('amount:asc', allowed, fallback)).toEqual({ amount: 'asc' });
    expect(parseSort('id:asc', allowed, fallback)).toEqual(fallback);
    expect(parseSort('amount:; DROP TABLE', allowed, fallback)).toEqual(fallback);
    expect(parseSort(undefined, allowed, fallback)).toEqual(fallback);
  });
});
