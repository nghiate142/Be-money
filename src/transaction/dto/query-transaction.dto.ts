import { IsArray, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { ListQueryDto } from '../../common/list-query.dto';
import { ToIdArray, ToInt } from '../../common/query.util';
import { KINDS } from '../../category/dto/create-category.dto';
import type { Kind } from '../../category/dto/create-category.dto';
import { NATURES } from '../../common/money.util';
import type { Nature } from '../../common/money.util';

export const SCOPES = ['project', 'personal'] as const;

export class QueryTransactionDto extends ListQueryDto {
  @IsOptional()
  @IsIn(KINDS)
  kind?: Kind;

  /** operating = kinh doanh/tiêu dùng, financing = vay/trả gốc, interest = lãi vay. */
  @IsOptional()
  @IsIn(NATURES)
  nature?: Nature;

  /** project = thuộc một công việc bất kỳ, personal = chi tiêu hằng ngày. */
  @IsOptional()
  @IsIn(SCOPES)
  scope?: (typeof SCOPES)[number];

  @IsOptional()
  @ToIdArray()
  @IsArray()
  categoryId?: number[];

  /** `projectId=none` để lấy giao dịch không thuộc công việc nào. */
  @IsOptional()
  @ToIdArray()
  @IsArray()
  projectId?: (number | null)[];

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
