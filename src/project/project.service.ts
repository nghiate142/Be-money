import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRepository } from './project.repository';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { paginate } from '../common/query.util';

const SORTABLE = ['profit', 'income', 'expense', 'name', 'startedAt'] as const;

@Injectable()
export class ProjectService {
  constructor(private readonly repo: ProjectRepository) {}

  /**
   * Lọc + sắp xếp theo profit/income/expense phải làm sau khi cộng tiền,
   * nên load hết project khớp bộ lọc rồi mới phân trang trong bộ nhớ.
   * ponytail: đủ cho vài trăm project; nếu vượt vài nghìn thì chuyển sang raw SQL có GROUP BY.
   */
  async findAll(dto: QueryProjectDto) {
    const projects = await this.repo.findMatching(dto);
    const rows = await this.withTotals(projects, dto.from, dto.to);

    const [field, dir = 'desc'] = (dto.sort ?? 'profit:desc').split(':');
    const key = (SORTABLE as readonly string[]).includes(field) ? field : 'profit';
    const sign = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const x = (a as any)[key];
      const y = (b as any)[key];
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sign;
    });

    return paginate(
      rows.slice(dto.skip, dto.skip + dto.limit),
      rows.length,
      dto.page,
      dto.limit,
    );
  }

  async findOne(id: number) {
    const found = await this.repo.findOne(id);
    if (!found) throw new NotFoundException('Không tìm thấy công việc');
    return found;
  }

  async summary(id: number, from?: string, to?: string) {
    const project = await this.findOne(id);
    const [row] = await this.withTotals([project], from, to);
    return row;
  }

  create(dto: CreateProjectDto) {
    return this.repo.create(dto);
  }

  async update(id: number, dto: UpdateProjectDto) {
    await this.findOne(id);
    return this.repo.update(id, dto);
  }

  async remove(id: number) {
    await this.findOne(id);
    const { transactions, debts } = await this.repo.countRefs(id);
    if (transactions || debts)
      throw new BadRequestException(
        `Công việc còn ${transactions} giao dịch và ${debts} khoản nợ, không xoá được`,
      );
    return this.repo.remove(id);
  }

  private async withTotals<T extends { id: number }>(
    projects: T[],
    from?: string,
    to?: string,
  ) {
    if (!projects.length) return [];
    const sums = await this.repo.sumByProject(
      projects.map((p) => p.id),
      from,
      to,
    );
    return projects.map((p) => {
      const pick = (kind: string) =>
        sums.find((s) => s.projectId === p.id && s.kind === kind)?._sum.amount ?? 0;
      const income = pick('income');
      const expense = pick('expense');
      return { ...p, income, expense, profit: income - expense };
    });
  }
}
