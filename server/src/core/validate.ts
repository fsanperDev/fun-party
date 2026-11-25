export const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const int = (v: unknown, fallback: number | null = null): number | null => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};
export const strList = (v: unknown, maxItems = 40): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, 1000)).filter(Boolean).slice(0, maxItems) : [];
