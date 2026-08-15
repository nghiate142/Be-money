import {
  IsIn,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { KINDS } from '../../category/dto/create-category.dto';
import type { Kind } from '../../category/dto/create-category.dto';

export class CreateTransactionDto {
  @IsISO8601()
  date!: string;

  /**
   * Số tiền như đã thanh toán, tính bằng đơn vị nhỏ nhất của `currency`
   * (VND: đồng, USD: cent). Số quy đổi ra VND do server tính, không nhận từ client.
   */
  @IsInt()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  /**
   * Tỷ giá 1 đơn vị ngoại tệ = ? VND. Bỏ trống thì server tự lấy tỷ giá
   * của `date` (gọi API rồi cache). Truyền vào để chốt cứng tỷ giá đã dùng.
   */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  rate?: number;

  /** Phí giao dịch tính bằng VND (phí chuyển tiền quốc tế, phí ngân hàng…). */
  @IsOptional()
  @IsInt()
  @Min(0)
  fee?: number;

  @IsIn(KINDS)
  kind!: Kind;

  @IsInt()
  categoryId!: number;

  @IsOptional()
  @IsInt()
  projectId?: number | null;

  /** Trả cho ai / nhận từ ai. Không dính dáng tới dư nợ. */
  @IsOptional()
  @IsInt()
  personId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
