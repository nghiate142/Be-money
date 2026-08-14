import { IsArray, IsIn, IsISO8601, IsInt, IsOptional, Min } from 'class-validator';
import { ListQueryDto } from '../../common/list-query.dto';
import { ToIdArray, ToInt } from '../../common/query.util';
import { DIRECTIONS } from './create-debt.dto';
import type { Direction } from './create-debt.dto';

export const DEBT_STATUS = ['active', 'overdue', 'paid'] as const;

/** `from`/`to` lọc theo ngày chuyển tiền; `dueFrom`/`dueTo` lọc theo hạn trả. */
export class QueryDebtDto extends ListQueryDto {
  @IsOptional()
  @IsIn(DIRECTIONS)
  direction?: Direction;

  /** active = đang nợ còn hạn, overdue = quá hạn, paid = đã trả xong. */
  @IsOptional()
  @IsIn(DEBT_STATUS)
  status?: (typeof DEBT_STATUS)[number];

  @IsOptional()
  @ToIdArray()
  @IsArray()
  personId?: number[];

  @IsOptional()
  @ToIdArray()
  @IsArray()
  projectId?: (number | null)[];

  @IsOptional()
  @IsISO8601()
  dueFrom?: string;

  @IsOptional()
  @IsISO8601()
  dueTo?: string;

  /** Lọc theo số tiền còn lại. */
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  amountMin?: number;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  amountMax?: number;
}
