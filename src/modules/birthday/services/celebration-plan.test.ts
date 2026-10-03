import { describe, expect, it } from "vitest";
import { planCelebrations, type BirthdayRecord } from "./celebration-plan.js";

const record = (
  userId: string,
  day: number,
  month: number,
  overrides: Partial<BirthdayRecord> = {}
): BirthdayRecord => ({
  userId,
  day,
  month,
  lastCelebratedYear: null,
  grantedRoleId: null,
  ...overrides,
});

const now = { year: 2026, month: 10, day: 3, hour: 9 };

describe("planCelebrations", () => {
  it("celebrates today's birthdays once the announcement hour is reached", () => {
    const records = [record("alice", 3, 10), record("bob", 4, 10)];
    expect(planCelebrations(records, now, 9, "role")).toEqual({
      celebrate: ["alice"],
      revoke: [],
      regrant: [],
    });
  });

  it("waits for the announcement hour", () => {
    expect(
      planCelebrations([record("alice", 3, 10)], now, 10, "role").celebrate
    ).toEqual([]);
  });

  it("does not celebrate twice in the same year", () => {
    const records = [record("alice", 3, 10, { lastCelebratedYear: 2026 })];
    expect(planCelebrations(records, now, 9, "role").celebrate).toEqual([]);
  });

  it("celebrates again the following year", () => {
    const records = [record("alice", 3, 10, { lastCelebratedYear: 2025 })];
    expect(planCelebrations(records, now, 9, "role").celebrate).toEqual([
      "alice",
    ]);
  });

  it("revokes the granted role once the birthday is over", () => {
    const records = [
      record("alice", 2, 10, { lastCelebratedYear: 2026, grantedRoleId: "r" }),
      record("bob", 3, 10, { lastCelebratedYear: 2026, grantedRoleId: "r" }),
    ];
    expect(planCelebrations(records, now, 9, "r")).toEqual({
      celebrate: [],
      revoke: [{ userId: "alice", roleId: "r" }],
      regrant: [],
    });
  });

  it("swaps the role when the configured one changes during the day", () => {
    const records = [
      record("alice", 3, 10, {
        lastCelebratedYear: 2026,
        grantedRoleId: "old",
      }),
    ];
    expect(planCelebrations(records, now, 9, "new")).toEqual({
      celebrate: [],
      revoke: [{ userId: "alice", roleId: "old" }],
      regrant: ["alice"],
    });
  });

  it("only revokes when the role is unset during the day", () => {
    const records = [
      record("alice", 3, 10, {
        lastCelebratedYear: 2026,
        grantedRoleId: "old",
      }),
    ];
    expect(planCelebrations(records, now, 9, null)).toEqual({
      celebrate: [],
      revoke: [{ userId: "alice", roleId: "old" }],
      regrant: [],
    });
  });
});
