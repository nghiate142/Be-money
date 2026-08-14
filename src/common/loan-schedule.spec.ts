import {
  addMonths,
  buildSchedule,
  reconcile,
  type LoanTerms,
} from './loan-schedule';

const D = (s: string) => new Date(`${s}T00:00:00Z`);

const terms = (over: Partial<LoanTerms>): LoanTerms => ({
  principal: 120_000_000,
  startDate: D('2026-01-15'),
  termMonths: 12,
  paymentDay: null,
  interestMethod: 'declining',
  interestRate: 1, // 1%/tháng
  fixedInterestAmount: null,
  ...over,
});

const sum = (rows: { principal?: number; interest?: number }[], key: 'principal' | 'interest') =>
  rows.reduce((s, r) => s + (r[key] ?? 0), 0);

describe('ngày đến hạn', () => {
  it('cộng tháng bình thường', () => {
    expect(addMonths(D('2026-01-15'), 1).toISOString().slice(0, 10)).toBe('2026-02-15');
  });

  it('tháng đích ngắn hơn thì lùi về ngày cuối tháng', () => {
    expect(addMonths(D('2026-01-31'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(addMonths(D('2026-01-31'), 3).toISOString().slice(0, 10)).toBe('2026-04-30');
  });

  it('paymentDay đè lên ngày của startDate', () => {
    expect(addMonths(D('2026-01-15'), 1, 5).toISOString().slice(0, 10)).toBe('2026-02-05');
  });
});

describe('dư nợ giảm dần', () => {
  const rows = buildSchedule(terms({ interestMethod: 'declining' }));

  it('gốc chia đều và tổng đúng bằng gốc vay', () => {
    expect(rows).toHaveLength(12);
    expect(sum(rows, 'principal')).toBe(120_000_000);
    expect(rows[0].principal).toBe(10_000_000);
  });

  it('lãi tính trên dư nợ còn lại nên giảm dần', () => {
    expect(rows[0].interest).toBe(1_200_000); // 120tr × 1%
    expect(rows[1].interest).toBe(1_100_000); // 110tr × 1%
    expect(rows[11].interest).toBe(100_000); // 10tr × 1%
  });

  it('kỳ cuối tất toán hết dư nợ', () => {
    expect(rows[11].closing).toBe(0);
  });
});

describe('lãi phẳng trên gốc ban đầu', () => {
  const rows = buildSchedule(terms({ interestMethod: 'flat' }));

  it('lãi không đổi suốt kỳ vay', () => {
    expect(rows.every((r) => r.interest === 1_200_000)).toBe(true);
    expect(sum(rows, 'interest')).toBe(14_400_000);
  });

  it('trả nhiều lãi hơn dư nợ giảm dần cùng lãi suất', () => {
    const declining = buildSchedule(terms({ interestMethod: 'declining' }));
    expect(sum(rows, 'interest')).toBeGreaterThan(sum(declining, 'interest'));
  });
});

describe('trả góp đều EMI', () => {
  const rows = buildSchedule(terms({ interestMethod: 'annuity' }));

  it('tổng trả mỗi kỳ gần như bằng nhau', () => {
    const payments = rows.slice(0, 11).map((r) => r.payment);
    expect(Math.max(...payments) - Math.min(...payments)).toBeLessThanOrEqual(1);
  });

  it('gốc tăng dần, lãi giảm dần', () => {
    expect(rows[11].principal).toBeGreaterThan(rows[0].principal);
    expect(rows[11].interest).toBeLessThan(rows[0].interest);
  });

  it('tổng gốc vẫn đúng bằng gốc vay và tất toán ở kỳ cuối', () => {
    expect(sum(rows, 'principal')).toBe(120_000_000);
    expect(rows[11].closing).toBe(0);
  });

  it('lãi suất 0 thì chỉ chia đều gốc', () => {
    const zero = buildSchedule(terms({ interestMethod: 'annuity', interestRate: 0 }));
    expect(sum(zero, 'interest')).toBe(0);
    expect(sum(zero, 'principal')).toBe(120_000_000);
  });
});

describe('lãi cố định bằng tiền', () => {
  it('có kỳ hạn thì vẫn chia đều gốc', () => {
    const rows = buildSchedule(
      terms({ interestMethod: 'fixed', fixedInterestAmount: 2_000_000, interestRate: null }),
    );
    expect(sum(rows, 'principal')).toBe(120_000_000);
    expect(rows.every((r) => r.interest === 2_000_000)).toBe(true);
  });

  it('thấu chi không kỳ hạn thì các kỳ chỉ trả lãi', () => {
    const rows = buildSchedule(
      terms({
        interestMethod: 'fixed',
        fixedInterestAmount: 500_000,
        termMonths: null,
        startDate: D('2026-05-15'),
      }),
      D('2026-08-14'),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(sum(rows, 'principal')).toBe(0);
    expect(rows.every((r) => r.payment === 500_000)).toBe(true);
    expect(rows.every((r) => r.closing === 120_000_000)).toBe(true);
  });
});

describe('theo hợp đồng', () => {
  // Khoản vay thật của Shopee Pay: 17tr, 6 kỳ, 3,3%/tháng.
  // Họ dồn phần lẻ vào kỳ cuối theo quy ước riêng, không suy ra được từ lãi suất,
  // nên chép thẳng số tiền hợp đồng mới khớp tuyệt đối.
  const rows = buildSchedule(
    terms({
      principal: 17_000_000,
      startDate: D('2026-08-06'),
      termMonths: 6,
      interestMethod: 'contract',
      interestRate: null,
      contractPayment: 3_394_059,
      contractLastPayment: 3_420_905,
    }),
  );

  it('khớp đúng số tiền từng kỳ trong sao kê', () => {
    expect(rows.slice(0, 5).map((r) => r.payment)).toEqual([
      3_394_059, 3_394_059, 3_394_059, 3_394_059, 3_394_059,
    ]);
    expect(rows[5].payment).toBe(3_420_905);
  });

  it('tổng lãi bằng đúng con số bên cho vay báo', () => {
    expect(sum(rows, 'interest')).toBe(3_391_200);
    expect(sum(rows, 'principal')).toBe(17_000_000);
  });

  it('kỳ cuối tất toán hết dư nợ', () => {
    expect(rows[5].closing).toBe(0);
  });

  it('thiếu số tiền hợp đồng thì không sinh lịch', () => {
    expect(
      buildSchedule(terms({ interestMethod: 'contract', contractPayment: null })),
    ).toEqual([]);
  });
});

describe('không áp công thức lãi', () => {
  it('method none thì không sinh lịch', () => {
    expect(buildSchedule(terms({ interestMethod: 'none' }))).toEqual([]);
  });
});

describe('đối chiếu với số đã trả', () => {
  const schedule = buildSchedule(terms({ interestMethod: 'declining' }));
  const pay = (date: string, principalAmount: number, interestAmount: number) => ({
    date: D(date),
    principalAmount,
    interestAmount,
  });

  it('chưa trả gì thì kỳ đã qua là trễ, kỳ sau là sắp tới', () => {
    const { periods, summary } = reconcile(schedule, [], D('2026-03-20'));
    expect(periods[0].status).toBe('late');
    expect(periods[1].status).toBe('late');
    expect(periods[2].status).toBe('upcoming');
    expect(summary.nextDueDate?.toISOString().slice(0, 10)).toBe('2026-04-15');
    expect(summary.overdueAmount).toBe(periods[1].dueToDate);
  });

  it('trả đủ hai kỳ đầu thì hai kỳ đó là đã trả', () => {
    const { periods, summary } = reconcile(
      schedule,
      [pay('2026-02-15', 10_000_000, 1_200_000), pay('2026-03-15', 10_000_000, 1_100_000)],
      D('2026-03-20'),
    );
    expect(periods[0].status).toBe('paid');
    expect(periods[1].status).toBe('paid');
    expect(summary.overdueAmount).toBe(0);
    expect(summary.periodsLeft).toBe(10);
  });

  it('trả thiếu thì báo partial kèm số còn thiếu', () => {
    const { periods, summary } = reconcile(
      schedule,
      [pay('2026-02-15', 5_000_000, 1_200_000)],
      D('2026-02-20'),
    );
    expect(periods[0].status).toBe('partial');
    expect(periods[0].shortfall).toBe(11_200_000 - 6_200_000);
    expect(summary.paidTotal).toBe(6_200_000);
  });

  it('trả gộp trước nhiều kỳ vẫn tính đúng', () => {
    const { periods } = reconcile(
      schedule,
      [pay('2026-02-15', 30_000_000, 3_500_000)],
      D('2026-02-20'),
    );
    expect(periods[0].status).toBe('paid');
    expect(periods[1].status).toBe('paid');
    expect(periods[2].status).toBe('paid');
  });

  it('tổng lãi phải trả cả đời khoản vay', () => {
    const { summary } = reconcile(schedule, [], D('2026-01-16'));
    expect(summary.totalPrincipal).toBe(120_000_000);
    expect(summary.totalInterest).toBe(sum(schedule, 'interest'));
    expect(summary.totalPayment).toBe(summary.totalPrincipal + summary.totalInterest);
  });
});
