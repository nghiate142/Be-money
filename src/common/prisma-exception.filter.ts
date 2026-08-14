import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../generated/prisma/client';

/** Đổi lỗi Prisma thành HTTP status đúng, thay vì 500 kèm stack trace. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(e: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    switch (e.code) {
      case 'P2002':
        return super.catch(new ConflictException('Bản ghi đã tồn tại'), host);
      case 'P2003':
        return super.catch(
          new BadRequestException('Tham chiếu không tồn tại'),
          host,
        );
      case 'P2025':
        return super.catch(new NotFoundException('Không tìm thấy'), host);
      default:
        return super.catch(e, host);
    }
  }
}
