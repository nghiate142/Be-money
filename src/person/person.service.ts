import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PersonRepository } from './person.repository';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { QueryPersonDto } from './dto/query-person.dto';
import { paginate, parseSort } from '../common/query.util';

const SORTABLE = ['name', 'iOwe', 'owesMe', 'createdAt'] as const;

type PersonWithDebts = {
  debts: {
    direction: string;
    principal: number;
    payments: { principalAmount: number }[];
  }[];
};

/** Gom dư nợ hai chiều của một người qua tất cả khoản nợ. */
function withTotals<T extends PersonWithDebts>(person: T) {
  const totals = person.debts.reduce(
    (acc, d) => {
      const remaining =
        d.principal - d.payments.reduce((s, p) => s + p.principalAmount, 0);
      if (remaining > 0)
        acc[d.direction === 'i_owe' ? 'iOwe' : 'owesMe'] += remaining;
      return acc;
    },
    { iOwe: 0, owesMe: 0 },
  );
  const { debts, ...rest } = person;
  return { ...rest, ...totals, debtCount: debts.length };
}

@Injectable()
export class PersonService {
  constructor(private readonly repo: PersonRepository) {}

  async findAll(dto: QueryPersonDto) {
    let rows = (await this.repo.findMatching(dto)).map(withTotals);

    if (dto.status === 'owing') rows = rows.filter((p) => p.iOwe > 0 || p.owesMe > 0);
    else if (dto.status === 'clear')
      rows = rows.filter((p) => p.iOwe === 0 && p.owesMe === 0);

    const order = parseSort(dto.sort, SORTABLE, { name: 'asc' });
    const [key, dir] = Object.entries(order)[0];
    const sign = dir === 'desc' ? -1 : 1;
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
    if (!found) throw new NotFoundException('Không tìm thấy người này');
    return withTotals(found);
  }

  create(dto: CreatePersonDto) {
    return this.repo.create(dto);
  }

  async update(id: number, dto: UpdatePersonDto) {
    await this.findOne(id);
    return this.repo.update(id, dto);
  }

  async remove(id: number) {
    await this.findOne(id);
    const debts = await this.repo.countDebts(id);
    if (debts)
      throw new BadRequestException(
        `Người này còn ${debts} khoản nợ, không xoá được`,
      );
    return this.repo.remove(id);
  }
}
