import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { and } from '../common/query.util';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { QueryPersonDto } from './dto/query-person.dto';

/** Kèm khoản nợ + số đã trả để service gom được tổng dư nợ theo người. */
const WITH_DEBTS = {
  debts: {
    select: {
      direction: true,
      principal: true,
      payments: { select: { principalAmount: true } },
    },
  },
};

@Injectable()
export class PersonRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMatching(dto: QueryPersonDto) {
    return this.prisma.person.findMany({
      where: and(
        dto.q
          ? {
              OR: [
                { name: { contains: dto.q } },
                { phone: { contains: dto.q } },
                { note: { contains: dto.q } },
              ],
            }
          : undefined,
      ),
      include: WITH_DEBTS,
    });
  }

  findOne(id: number) {
    return this.prisma.person.findUnique({
      where: { id },
      include: WITH_DEBTS,
    });
  }

  create(dto: CreatePersonDto) {
    return this.prisma.person.create({ data: { ...dto, name: dto.name } });
  }

  update(id: number, dto: UpdatePersonDto) {
    return this.prisma.person.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.person.delete({ where: { id } });
  }

  countDebts(personId: number) {
    return this.prisma.debt.count({ where: { personId } });
  }
}
