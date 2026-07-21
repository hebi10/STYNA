const SEOUL_TIME_ZONE = "Asia/Seoul";
const DATE_ONLY_PATTERN = /^(\d{4})[-./](\d{2})[-./](\d{2})$/;

const seoulDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SEOUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function normalizeDateOnly(value: string): string | null {
  const match = DATE_ONLY_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function toInstant(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  if (value && typeof value === "object" && "toDate" in value) {
    try {
      const date = (value as { toDate: () => unknown }).toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
    } catch {
      return null;
    }
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  return null;
}

export function toKstDayKey(value: unknown): string {
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value.trim())) {
    const dateOnly = normalizeDateOnly(value);
    if (!dateOnly) {
      throw new RangeError("A valid date value is required.");
    }
    return dateOnly;
  }

  const instant = toInstant(value);
  if (!instant) {
    throw new RangeError("A valid date value is required.");
  }

  const parts = seoulDayFormatter.formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new RangeError("Unable to format the date in Asia/Seoul.");
  }

  return `${year}-${month}-${day}`;
}

export function parseCouponExpiryDay(value: unknown): string | null {
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value.trim())) {
    return normalizeDateOnly(value);
  }

  try {
    return toKstDayKey(value);
  } catch {
    return null;
  }
}

export function isExpiredOnKstDay(expiry: unknown, now: unknown = new Date()): boolean {
  const expiryDay = parseCouponExpiryDay(expiry);
  if (!expiryDay) {
    return true;
  }

  try {
    return expiryDay < toKstDayKey(now);
  } catch {
    return true;
  }
}
