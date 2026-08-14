import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { and, parseSort } from '../common/query.util';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';

const SORTABLE = ['name', 'kind', 'createdAt'] as const;

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private where(dto: QueryCategoryDto) {
    return and(
      dto.q ? { name: { contains: dto.q } } : undefined,
      dto.kind ? { kind: dto.kind } : undefined,
    );
  }

  async list(dto: QueryCategoryDto) {
    const where = this.where(dto);
    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: parseSort(dto.sort, SORTABLE, { name: 'asc' }),
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.category.count({ where }),
    ]);
    return { items, total };
  }

  findOne(id: number) {
    return this.prisma.category.findUnique({ where: { id } });
  }

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto });
  }

  update(id: number, dto: UpdateCategoryDto) {
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.category.delete({ where: { id } });
  }

  countTransactions(categoryId: number) {
    return this.prisma.transaction.count({ where: { categoryId } });
  }
}
