/** Local-calendar YYYY-MM-DD. Never use toISOString() for this: it converts to UTC and shifts IST dates back a day. */
export const localIso = (d: Date = new Date()): string => {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};
