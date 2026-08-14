import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDebtPaymentDto {
  @IsISO8601()
  date!: string;

  /** Phần trả vào gốc — chỉ phần này làm giảm số nợ còn lại. */
  @IsInt()
  @Min(0)
  principalAmount!: number;

  /** Phần trả lãi. Chỉ cho phép > 0 khi direction = i_owe (không cho vay lấy lãi). */
  @IsOptional()
  @IsInt()
  @Min(0)
  interestAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
