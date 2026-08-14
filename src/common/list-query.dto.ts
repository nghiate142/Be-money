import { IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { ToInt } from './query.util';

/** Bộ lọc dùng chung cho mọi danh sách. */
export class ListQueryDto {
  /** Tìm kiếm text */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  /** `field:asc|desc` */
  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;

  get skip() {
    return (this.page - 1) * this.limit;
  }
}
