import { IsIn, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../common/list-query.dto';

export const PROJECT_STATUS = ['open', 'closed'] as const;

/** `from`/`to` ở đây lọc khoảng thời gian của giao dịch khi tính thu/chi/lãi. */
export class QueryProjectDto extends ListQueryDto {
  @IsOptional()
  @IsIn(PROJECT_STATUS)
  status?: (typeof PROJECT_STATUS)[number];
}
