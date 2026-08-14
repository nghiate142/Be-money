import { IsIn, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../common/list-query.dto';
import { KINDS } from './create-category.dto';
import type { Kind } from './create-category.dto';

export class QueryCategoryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(KINDS)
  kind?: Kind;
}
