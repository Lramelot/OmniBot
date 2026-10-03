import { isBirthdayOn, type LocalDateTime } from "./birthday-dates.js";

export interface BirthdayRecord {
  userId: string;
  day: number;
  month: number;
  lastCelebratedYear: number | null;
  grantedRoleId: string | null;
}

export interface RoleRevocation {
  userId: string;
  roleId: string;
}

export interface CelebrationPlan {
  celebrate: string[];
  revoke: RoleRevocation[];
  regrant: string[];
}

export function planCelebrations(
  records: readonly BirthdayRecord[],
  now: LocalDateTime,
  announcementHour: number,
  roleId: string | null
): CelebrationPlan {
  const celebrate: string[] = [];
  const revoke: RoleRevocation[] = [];
  const regrant: string[] = [];

  for (const record of records) {
    const today = isBirthdayOn(record, now);
    const granted = record.grantedRoleId;

    if (granted !== null && (!today || granted !== roleId)) {
      revoke.push({ userId: record.userId, roleId: granted });
      if (today && roleId !== null) {
        regrant.push(record.userId);
      }
    }

    if (
      today &&
      now.hour >= announcementHour &&
      record.lastCelebratedYear !== now.year
    ) {
      celebrate.push(record.userId);
    }
  }

  return { celebrate, revoke, regrant };
}
