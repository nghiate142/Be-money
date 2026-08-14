import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { INTEREST_METHODS, LOAN_TYPES } from '../../common/loan-schedule';
import type { InterestMethod, LoanType } from '../../common/loan-schedule';

export const DIRECTIONS = ['i_owe', 'owes_me'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export class CreateDebtDto {
  @IsInt()
  personId!: number;

  /** i_owe = tôi nợ họ, owes_me = họ nợ tôi. */
  @IsIn(DIRECTIONS)
  direction!: Direction;

  @IsInt()
  @IsPositive()
  principal!: number;

  /** Ngày chuyển tiền — cũng là ngày của giao dịch tiền tự sinh ra. */
  @IsISO8601()
  date!: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string | null;

  /**
   * Có cộng tiền gốc vào số dư hiện tại không. Mặc định có.
   * Tắt khi ghi lại khoản vay cũ mà tiền đã tiêu hết trước lúc dùng app —
   * lúc đó chỉ theo dõi dư nợ, không đụng số dư.
   */
  @IsOptional()
  @IsBoolean()
  affectsBalance?: boolean;

  /** personal | unsecured (tín chấp) | secured (thế chấp) | overdraft (thấu chi) */
  @IsOptional()
  @IsIn(LOAN_TYPES)
  loanType?: LoanType;

  /** none | flat | declining | annuity | fixed — bỏ trống thì suy ra từ `loanType`. */
  @IsOptional()
  @IsIn(INTEREST_METHODS)
  interestMethod?: InterestMethod;

  /** %/tháng. Bắt buộc với flat | declining | annuity. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate?: number | null;

  /** VND/tháng. Bắt buộc với method = fixed. */
  @IsOptional()
  @IsInt()
  @Min(0)
  fixedInterestAmount?: number | null;

  /** VND/kỳ theo hợp đồng. Bắt buộc với method = contract. */
  @IsOptional()
  @IsInt()
  @Min(0)
  contractPayment?: number | null;

  /** VND kỳ cuối theo hợp đồng. Bỏ trống = bằng contractPayment. */
  @IsOptional()
  @IsInt()
  @Min(0)
  contractLastPayment?: number | null;

  /** Số kỳ trả. Bỏ trống = không kỳ hạn (thấu chi). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  termMonths?: number | null;

  /** Ngày trả hàng tháng 1–31. Bỏ trống thì lấy theo ngày chuyển tiền. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay?: number | null;

  /** Ghi chú lãi suất tự do, vd "2%/tháng đầu rồi thả nổi". */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  interestNote?: string | null;

  @IsOptional()
  @IsInt()
  projectId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
