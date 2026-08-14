import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoryRepository } from './category.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import { paginate } from '../common/query.util';

@Injectable()
export class CategoryService {
  constructor(private readonly repo: CategoryRepository) {}

  async findAll(dto: QueryCategoryDto) {
    const { items, total } = await this.repo.list(dto);
    return paginate(items, total, dto.page, dto.limit);
  }

  async findOne(id: number) {
    const found = await this.repo.findOne(id);
    if (!found) throw new NotFoundException('Không tìm thấy danh mục');
    return found;
  }

  create(dto: CreateCategoryDto) {
    return this.repo.create(dto);
  }

  async update(id: number, dto: UpdateCategoryDto) {
    this.assertNotSystem(await this.findOne(id));
    return this.repo.update(id, dto);
  }

  async remove(id: number) {
    this.assertNotSystem(await this.findOne(id));
    const used = await this.repo.countTransactions(id);
    if (used)
      throw new BadRequestException(
        `Danh mục đang được dùng bởi ${used} giao dịch, không xoá được`,
      );
    return this.repo.remove(id);
  }

  /** Danh mục hệ thống (Vay nợ, Trả nợ gốc, Lãi vay…) do code dùng, không cho đụng vào. */
  private assertNotSystem(category: { code: string | null; name: string }) {
    if (category.code)
      throw new BadRequestException(
        `"${category.name}" là danh mục hệ thống, không sửa/xoá được`,
      );
  }
}
