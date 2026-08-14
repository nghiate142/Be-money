import { IsIn, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../common/list-query.dto';

export const PERSON_STATUS = ['owing', 'clear'] as const;

export class QueryPersonDto extends ListQueryDto {
  /** owing = còn dư nợ ở một trong hai chiều, clear = đã sạch nợ. */
  @IsOptional()
  @IsIn(PERSON_STATUS)
  status?: (typeof PERSON_STATUS)[number];
}
