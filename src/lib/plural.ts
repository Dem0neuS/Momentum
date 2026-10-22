/**
 * Русская форма множественного числа: plural(5, ['день', 'дня', 'дней']).
 * Вынесено из utils, чтобы dates не тянул tailwind-merge/clsx ради склонения.
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}
