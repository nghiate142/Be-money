/**
 * Biến môi trường để trống trong api.env vẫn được truyền vào dưới dạng chuỗi
 * rỗng, nên `process.env.X ?? mặc_định` sẽ giữ nguyên chuỗi rỗng. Dùng hàm này
 * cho mọi biến mà api.env.example ghi "bỏ trống = …".
 */
export function envOr<T>(name: string, fallback: T): string | T {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}
