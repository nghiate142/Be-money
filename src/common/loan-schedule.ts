/**
 * Sinh lịch trả nợ theo 4 cách tính lãi thông dụng ở VN, và đối chiếu với
 * số đã trả thực tế. Thuần tính toán, không đụng DB — xem loan-schedule.spec.ts.
 *
 * Mọi số tiền là Int VND. Chênh lệch do làm tròn dồn hết vào kỳ cuối,
 * nên tổng gốc các kỳ luôn đúng bằng gốc vay.
 */

export const INTEREST_METHODS = [
  'none',
  'flat',
  'declining',
  'annuity',
  'fixed',
  'contract',
] as const;
export type InterestMethod = (typeof INTEREST_METHODS)[number];

export const LOAN_TYPES = ['personal', 'unsecured', 'secured', 'overdraft'] as const;
export type LoanType = (typeof LOAN_TYPES)[number];

/** Cách tính lãi gợi ý theo loại vay — người dùng vẫn đổi được. */
export const DEFAULT_METHOD: Record<LoanType, InterestMethod> = {
  personal: 'none',
  unsecured: 'flat', // công ty tài chính thường tính trên gốc ban đầu
  secured: 'declining', // ngân hàng thường tính trên dư nợ giảm dần
  overdraft: 'fixed',
};

/** Số kỳ tối đa sinh ra cho khoản không có kỳ hạn (thấu chi). */
const OPEN_ENDED_CAP = 120;

export type LoanTerms = {
  principal: number;
  startDate: Date;
  termMonths: number | null;
  paymentDay: number | null;
  interestMethod: InterestMethod;
  interestRate: number | null; // %/tháng
  fixedInterestAmount: number | null; // VND/tháng
  contractPayment?: number | null; // VND/kỳ theo hợp đồng
  contractLastPayment?: number | null; // VND kỳ cuối, bỏ trống = như các kỳ trước
};

export type SchedulePeriod = {
  index: number;
  dueDate: Date;
  opening: number;
  principal: number;
  interest: number;
  payment: number;
  closing: number;
};

/** Cộng tháng, tự lùi ngày khi tháng đích ngắn hơn (31/01 + 1 tháng = 28/02). */
export function addMonths(from: Date, months: number, day?: number | null): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + months;
  const wanted = day ?? from.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(wanted, lastDay)));
}

/**
 * Lịch trả nợ. Trả mảng rỗng nếu khoản nợ không có công thức lãi
 * (`none`) — loại này chỉ ghi tay từng lần trả.
 */
export function buildSchedule(terms: LoanTerms, now = new Date()): SchedulePeriod[] {
  const { principal, interestMethod: method } = terms;
  if (method === 'none' || principal <= 0) return [];

  const rate = (terms.interestRate ?? 0) / 100;
  const fixed = terms.fixedInterestAmount ?? 0;
  if (method === 'contract' && !terms.contractPayment) return [];
  const n = terms.termMonths ?? openEndedPeriods(terms.startDate, now);
  if (n <= 0) return [];

  // Gốc mỗi kỳ: chia đều, kỳ cuối gánh phần lẻ.
  // Thấu chi không kỳ hạn thì các kỳ chỉ trả lãi, gốc trả lúc nào tuỳ.
  const openEnded = terms.termMonths === null;
  const evenPrincipal = openEnded ? 0 : Math.floor(principal / n);

  const annuityPayment =
    method === 'annuity' ? annuityInstalment(principal, rate, n) : 0;

  const periods: SchedulePeriod[] = [];
  let opening = principal;

  for (let k = 1; k <= n; k++) {
    const last = k === n;
    let interest: number;
    let principalPart: number;

    switch (method) {
      case 'flat':
        interest = Math.round(principal * rate);
        principalPart = last ? opening : evenPrincipal;
        break;
      case 'declining':
        interest = Math.round(opening * rate);
        principalPart = last ? opening : evenPrincipal;
        break;
      case 'annuity':
        interest = Math.round(opening * rate);
        principalPart = last
          ? opening
          : Math.min(opening, annuityPayment - interest);
        break;
      case 'fixed':
        interest = fixed;
        principalPart = openEnded ? 0 : last ? opening : evenPrincipal;
        break;
      case 'contract': {
        // Chép nguyên số tiền hợp đồng; lãi suy ngược ra = tiền trả − gốc.
        // Nhờ vậy khớp tuyệt đối với sao kê của bên cho vay, không phụ thuộc
        // cách họ làm tròn.
        principalPart = last ? opening : evenPrincipal;
        const due = last
          ? (terms.contractLastPayment ?? terms.contractPayment ?? 0)
          : (terms.contractPayment ?? 0);
        interest = Math.max(0, due - principalPart);
        break;
      }
      default:
        interest = 0;
        principalPart = 0;
    }

    principalPart = Math.max(0, Math.min(principalPart, opening));
    const closing = opening - principalPart;

    periods.push({
      index: k,
      dueDate: addMonths(terms.startDate, k, terms.paymentDay),
      opening,
      principal: principalPart,
      interest,
      payment: principalPart + interest,
      closing,
    });

    opening = closing;
  }

  return periods;
}

/** Tiền trả đều mỗi kỳ của phương pháp EMI. Lãi suất 0 thì chia đều gốc. */
function annuityInstalment(principal: number, rate: number, n: number): number {
  if (rate <= 0) return Math.ceil(principal / n);
  const f = Math.pow(1 + rate, n);
  return Math.round((principal * rate * f) / (f - 1));
}

/** Thấu chi: sinh các kỳ đã qua cộng thêm 2 kỳ tới để còn thấy "kỳ sắp phải trả". */
function openEndedPeriods(startDate: Date, now: Date): number {
  const months =
    (now.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - startDate.getUTCMonth());
  return Math.min(OPEN_ENDED_CAP, Math.max(1, months + 2));
}

export type PaymentRecord = {
  date: Date;
  principalAmount: number;
  interestAmount: number;
};

export type PeriodStatus = 'paid' | 'partial' | 'late' | 'upcoming';

export type ReconciledPeriod = SchedulePeriod & {
  /** Luỹ kế phải trả và đã trả tính tới hết kỳ này. */
  dueToDate: number;
  paidToDate: number;
  shortfall: number;
  status: PeriodStatus;
};

/**
 * Đối chiếu lịch với số đã trả thật, theo luỹ kế chứ không khớp từng kỳ —
 * trả trước hay trả gộp nhiều kỳ đều tính đúng.
 */
export function reconcile(
  schedule: SchedulePeriod[],
  payments: PaymentRecord[],
  now = new Date(),
): { periods: ReconciledPeriod[]; summary: LoanSummary } {
  const paidTotal = payments.reduce(
    (s, p) => s + p.principalAmount + p.interestAmount,
    0,
  );

  let dueToDate = 0;
  const periods = schedule.map((p) => {
    dueToDate += p.payment;
    const paidToDate = Math.min(paidTotal, dueToDate);
    const shortfall = Math.max(0, dueToDate - paidTotal);
    const overdue = p.dueDate.getTime() <= now.getTime();
    const status: PeriodStatus =
      shortfall === 0
        ? 'paid'
        : overdue
          ? paidToDate > dueToDate - p.payment
            ? 'partial'
            : 'late'
          : 'upcoming';
    return { ...p, dueToDate, paidToDate, shortfall, status };
  });

  const next = periods.find((p) => p.status === 'upcoming');
  const overdueAmount = periods
    .filter((p) => p.status === 'late' || p.status === 'partial')
    .reduce((max, p) => Math.max(max, p.shortfall), 0);

  return {
    periods,
    summary: {
      totalPrincipal: schedule.reduce((s, p) => s + p.principal, 0),
      totalInterest: schedule.reduce((s, p) => s + p.interest, 0),
      totalPayment: schedule.reduce((s, p) => s + p.payment, 0),
      paidTotal,
      nextDueDate: next?.dueDate ?? null,
      nextPayment: next?.payment ?? 0,
      overdueAmount,
      periodsLeft: periods.filter((p) => p.status !== 'paid').length,
    },
  };
}

export type LoanSummary = {
  totalPrincipal: number;
  totalInterest: number;
  totalPayment: number;
  paidTotal: number;
  nextDueDate: Date | null;
  nextPayment: number;
  overdueAmount: number;
  periodsLeft: number;
};
