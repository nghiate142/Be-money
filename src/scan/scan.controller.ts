import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ScanService } from './scan.service';

/** Ảnh gửi lên chỉ để đọc, không lưu lại ở đâu cả. */
const MAX_BYTES = 8 * 1024 * 1024;

@Controller('scan')
export class ScanController {
  constructor(private readonly service: ScanService) {}

  @Post('transaction')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  scan(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Thiếu ảnh');
    return this.service.scan(file);
  }
}
