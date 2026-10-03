export interface BirthdayDate {
  day: number;
  month: number;
}

export interface LocalDateTime extends BirthdayDate {
  year: number;
  hour: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidBirthday({ day, month }: BirthdayDate): boolean {
  return (
    Number.isInteger(day) &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(month, 2000)
  );
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function localDateTime(now: Date, timeZone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
  };
}

export function celebrationDay(
  { day, month }: BirthdayDate,
  year: number
): BirthdayDate {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return { day: 28, month: 2 };
  }
  return { day, month };
}

export function isBirthdayOn(
  birthday: BirthdayDate,
  today: BirthdayDate & { year: number }
): boolean {
  const celebrated = celebrationDay(birthday, today.year);
  return celebrated.day === today.day && celebrated.month === today.month;
}

export function daysUntilBirthday(
  birthday: BirthdayDate,
  today: BirthdayDate & { year: number }
): number {
  const todayMs = Date.UTC(today.year, today.month - 1, today.day);
  for (const year of [today.year, today.year + 1]) {
    const { day, month } = celebrationDay(birthday, year);
    const diff = Date.UTC(year, month - 1, day) - todayMs;
    if (diff >= 0) {
      return Math.round(diff / DAY_MS);
    }
  }
  return 0;
}

export function parseAnnouncementHour(value: string): number {
  const hour = Number.parseInt(value, 10);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 9;
}
