import { describe, expect, it } from "vitest";
import {
  daysUntilBirthday,
  isBirthdayOn,
  isValidBirthday,
  isValidTimeZone,
  localDateTime,
  parseAnnouncementHour,
} from "./birthday-dates.js";

describe("isValidBirthday", () => {
  it("accepts February 29", () => {
    expect(isValidBirthday({ day: 29, month: 2 })).toBe(true);
  });

  it("rejects days that never exist", () => {
    expect(isValidBirthday({ day: 30, month: 2 })).toBe(false);
    expect(isValidBirthday({ day: 31, month: 4 })).toBe(false);
    expect(isValidBirthday({ day: 1, month: 13 })).toBe(false);
    expect(isValidBirthday({ day: 0, month: 1 })).toBe(false);
  });
});

describe("isValidTimeZone", () => {
  it("recognises IANA zones and rejects garbage", () => {
    expect(isValidTimeZone("Europe/Paris")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});

describe("localDateTime", () => {
  it("reads the date and hour in the given zone", () => {
    const now = new Date("2026-12-31T23:30:00Z");
    expect(localDateTime(now, "UTC")).toEqual({
      year: 2026,
      month: 12,
      day: 31,
      hour: 23,
    });
    expect(localDateTime(now, "Europe/Paris")).toEqual({
      year: 2027,
      month: 1,
      day: 1,
      hour: 0,
    });
  });
});

describe("isBirthdayOn", () => {
  const leapBirthday = { day: 29, month: 2 };

  it("celebrates February 29 on February 28 in common years", () => {
    expect(isBirthdayOn(leapBirthday, { year: 2027, month: 2, day: 28 })).toBe(
      true
    );
    expect(isBirthdayOn(leapBirthday, { year: 2028, month: 2, day: 28 })).toBe(
      false
    );
    expect(isBirthdayOn(leapBirthday, { year: 2028, month: 2, day: 29 })).toBe(
      true
    );
  });
});

describe("daysUntilBirthday", () => {
  const today = { year: 2026, month: 10, day: 3 };

  it("is zero on the day itself", () => {
    expect(daysUntilBirthday({ day: 3, month: 10 }, today)).toBe(0);
  });

  it("counts forward within the year", () => {
    expect(daysUntilBirthday({ day: 10, month: 10 }, today)).toBe(7);
  });

  it("wraps to next year once the day has passed", () => {
    expect(daysUntilBirthday({ day: 2, month: 10 }, today)).toBe(364);
  });
});

describe("parseAnnouncementHour", () => {
  it("reads the hour of an HH:00 option", () => {
    expect(parseAnnouncementHour("00:00")).toBe(0);
    expect(parseAnnouncementHour("18:00")).toBe(18);
  });

  it("falls back to 9 on an unexpected value", () => {
    expect(parseAnnouncementHour("noon")).toBe(9);
  });
});
