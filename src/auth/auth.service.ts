import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';

/** App 1 người dùng: tài khoản nằm trong .env, không có bảng User. */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login({ username, password }: LoginDto) {
    const user = this.config.get<string>('APP_USER');
    const hash = this.config.get<string>('APP_PASSWORD_HASH');
    if (!user || !hash)
      throw new UnauthorizedException('Chưa cấu hình APP_USER/APP_PASSWORD_HASH');

    const ok = username === user && (await bcrypt.compare(password, hash));
    if (!ok) throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');

    return {
      access_token: await this.jwt.signAsync({ sub: user, username: user }),
      username: user,
    };
  }
}
