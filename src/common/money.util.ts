export const NATURES = ['operating', 'financing', 'interest'] as const;
export type Nature = (typeof NATURES)[number];

/** Chỉ `operating` và `interest` mới vào lãi/lỗ. Vay/trả gốc không phải lãi lỗ. */
export const PNL_NATURES: Nature[] = ['operating', 'interest'];

export type DebtStatus = 'active' | 'overdue' | 'paid';

/**
 * Quy đổi tiền đã thanh toán sang VND.
 * `original` tính bằng đơn vị nhỏ nhất của loại tiền (USD lưu theo cent),
 * `rate` là 1 đơn vị lớn = ? VND. Kết quả làm tròn về đồng.
 */
export function toVnd(original: number, decimals: number, rate: number): number {
  return Math.round((original / 10 ** decimals) * rate);
}

type DebtRow = {
  principal: number;
  dueDate: Date | null;
  payments: { principalAmount: number; interestAmount: number }[];
};

/**
 * paid = tổng gốc đã trả, remaining = gốc − đã trả, interestPaid = tổng lãi đã trả.
 * Trạng thái KHÔNG lưu trong DB, luôn tính lại để không bao giờ lệch với số tiền.
 */
export function withRemaining<T extends DebtRow>(debt: T, now = new Date()) {
  const paid = debt.payments.reduce((s, p) => s + p.principalAmount, 0);
  const interestPaid = debt.payments.reduce((s, p) => s + p.interestAmount, 0);
  const remaining = debt.principal - paid;
  const status: DebtStatus =
    remaining <= 0
      ? 'paid'
      : debt.dueDate && debt.dueDate.getTime() < now.getTime()
        ? 'overdue'
        : 'active';
  return { ...debt, paid, interestPaid, remaining, status };
}
