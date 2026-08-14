import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { and, dateRange } from '../common/query.util';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';

@Injectable()
export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Lọc project (chưa gồm phần tổng hợp tiền). */
  findMatching(dto: QueryProjectDto) {
    return this.prisma.project.findMany({
      where: and(
        dto.q
          ? { OR: [{ name: { contains: dto.q } }, { note: { contains: dto.q } }] }
          : undefined,
        dto.status === 'open'
          ? { closedAt: null }
          : dto.status === 'closed'
            ? { NOT: { closedAt: null } }
            : undefined,
      ),
    });
  }

  /** Tổng thu/chi theo từng project trong khoảng thời gian. */
  sumByProject(projectIds: number[], from?: string, to?: string) {
    return this.prisma.transaction.groupBy({
      by: ['projectId', 'kind'],
      where: and(
        { projectId: { in: projectIds } },
        dateRange(from, to) ? { date: dateRange(from, to) } : undefined,
      ),
      _sum: { amount: true },
    });
  }

  findOne(id: number) {
    return this.prisma.project.findUnique({ where: { id } });
  }

  create(dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: { ...this.toData(dto), name: dto.name },
    });
  }

  update(id: number, dto: UpdateProjectDto) {
    return this.prisma.project.update({ where: { id }, data: this.toData(dto) });
  }

  remove(id: number) {
    return this.prisma.project.delete({ where: { id } });
  }

  async countRefs(projectId: number) {
    const [transactions, debts] = await Promise.all([
      this.prisma.transaction.count({ where: { projectId } }),
      this.prisma.debt.count({ where: { projectId } }),
    ]);
    return { transactions, debts };
  }

  private toData(dto: CreateProjectDto | UpdateProjectDto) {
    return {
      ...dto,
      ...(dto.startedAt ? { startedAt: new Date(dto.startedAt) } : {}),
      ...(dto.closedAt !== undefined
        ? { closedAt: dto.closedAt ? new Date(dto.closedAt) : null }
        : {}),
    };
  }
}
