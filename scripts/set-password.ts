/** Đặt mật khẩu và ghi thẳng vào .env: npm run set-password -- "mật khẩu mới" */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Dùng: npm run set-password -- "mật khẩu mới"');
  process.exit(1);
}

const file = resolve(__dirname, '..', '.env');
const hash = bcrypt.hashSync(password, 10);
const line = `APP_PASSWORD_HASH="${hash}"`;

const env = readFileSync(file, 'utf8');
writeFileSync(
  file,
  /^APP_PASSWORD_HASH=.*$/m.test(env)
    ? env.replace(/^APP_PASSWORD_HASH=.*$/m, line)
    : `${env.trimEnd()}\n${line}\n`,
  'utf8',
);

// Tự kiểm tra lại để chắc chắn hash vừa ghi khớp mật khẩu vừa nhập.
if (!bcrypt.compareSync(password, hash)) throw new Error('Hash không khớp');
console.log('Đã cập nhật APP_PASSWORD_HASH trong .env. Khởi động lại API để áp dụng.');
