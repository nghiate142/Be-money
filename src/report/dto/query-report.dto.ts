import { IsInt, IsISO8601, IsOptional } from 'class-validator';
import { ToInt } from '../../common/query.util';

/**
 * Bộ lọc chung của mọi báo cáo: khoảng ngày + thu hẹp theo công việc,
 * danh mục hoặc người. Bỏ trống nghĩa là không giới hạn.
 */
export class QueryReportDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @ToInt()
  @IsInt()
  projectId?: number;

  @IsOptional()
  @ToInt()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @ToInt()
  @IsInt()
  personId?: number;
}
