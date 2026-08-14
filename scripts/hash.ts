/** Tạo APP_PASSWORD_HASH: npm run hash -- "mật khẩu của bạn" */
import * as bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Dùng: npm run hash -- "mật khẩu"');
  process.exit(1);
}
console.log(bcrypt.hashSync(password, 10));
