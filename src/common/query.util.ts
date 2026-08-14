import { Transform } from 'class-transformer';

/** `?x=1` và `?x=1&x=2` đều thành array. `none` -> null (nghĩa là "không thuộc mục nào"). */
export const ToIdArray = () =>
  Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    return (Array.isArray(value) ? value : [value]).map((v: string) =>
      v === 'none' ? null : Number(v),
    );
  });

export const ToInt = () =>
  Transform(({ value }) =>
    value === undefined || value === '' ? undefined : Number(value),
  );

export const ToBool = () =>
  Transform(({ value }) =>
    value === undefined || value === '' ? undefined : value === 'true' || value === true,
  );

/** 'YYYY-MM-DD' -> cuối ngày, để filter `to` bao gồm cả ngày đó. */
export function endOfDay(v: string): Date {
  return new Date(v.length === 10 ? `${v}T23:59:59.999Z` : v);
}

export function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: endOfDay(to) } : {}),
  };
}

/** Lọc theo id, hỗ trợ `null` = bản ghi không gắn với mục nào. */
export function idFilter(field: string, values?: (number | null)[]) {
  if (!values?.length) return undefined;
  const ids = values.filter((v): v is number => v !== null);
  const hasNone = ids.length !== values.length;
  if (hasNone && ids.length)
    return { OR: [{ [field]: { in: ids } }, { [field]: null }] };
  if (hasNone) return { [field]: null };
  return { [field]: { in: ids } };
}

export function amountRange(min?: number, max?: number) {
  if (min === undefined && max === undefined) return undefined;
  return {
    ...(min !== undefined ? { gte: min } : {}),
    ...(max !== undefined ? { lte: max } : {}),
  };
}

/** `field:asc|desc`, chỉ nhận field trong whitelist — không đẩy thẳng input vào orderBy. */
export function parseSort<T extends string>(
  sort: string | undefined,
  allowed: readonly T[],
  fallback: Record<string, 'asc' | 'desc'>,
): Record<string, 'asc' | 'desc'> {
  if (!sort) return fallback;
  const [field, dir = 'asc'] = sort.split(':');
  if (!allowed.includes(field as T) || (dir !== 'asc' && dir !== 'desc'))
    return fallback;
  return { [field]: dir };
}

/** Gom các mảnh where lại; dùng AND để nhiều mảnh có `OR` không đè key của nhau. */
export function and(...parts: (object | undefined)[]) {
  const list = parts.filter(Boolean) as object[];
  return list.length ? { AND: list } : {};
}

export function paginate<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, limit };
}
