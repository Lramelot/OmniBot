import prisma from "#lib/database.js";
import { declareService, type Service } from "#lib/service.js";
import {
  daysUntilBirthday,
  type BirthdayDate,
  type LocalDateTime,
} from "./birthday-dates.js";
import type { BirthdayRecord, RoleRevocation } from "./celebration-plan.js";

export interface UpcomingBirthday extends BirthdayDate {
  userId: string;
  daysUntil: number;
}

class BirthdayService implements Service {
  async getBirthday(
    guildId: string,
    userId: string
  ): Promise<BirthdayDate | null> {
    const row = await prisma.birthday.findUnique({
      where: { guildId_userId: { guildId, userId } },
      select: { day: true, month: true },
    });
    return row ?? null;
  }

  async setBirthday(
    guildId: string,
    userId: string,
    { day, month }: BirthdayDate
  ): Promise<"created" | "updated"> {
    const existing = await this.getBirthday(guildId, userId);
    await prisma.birthday.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: { guildId, userId, day, month },
      update: { day, month },
    });
    return existing ? "updated" : "created";
  }

  async removeBirthday(guildId: string, userId: string): Promise<boolean> {
    const { count } = await prisma.birthday.deleteMany({
      where: { guildId, userId },
    });
    return count > 0;
  }

  listBirthdays(guildId: string): Promise<BirthdayRecord[]> {
    return prisma.birthday.findMany({
      where: { guildId },
      select: {
        userId: true,
        day: true,
        month: true,
        lastCelebratedYear: true,
        grantedRoleId: true,
      },
    });
  }

  async getUpcoming(
    guildId: string,
    today: LocalDateTime
  ): Promise<UpcomingBirthday[]> {
    const rows = await this.listBirthdays(guildId);
    return rows
      .map(({ userId, day, month }) => ({
        userId,
        day,
        month,
        daysUntil: daysUntilBirthday({ day, month }, today),
      }))
      .sort(
        (a, b) => a.daysUntil - b.daysUntil || (a.userId < b.userId ? -1 : 1)
      );
  }

  async markCelebrated(
    guildId: string,
    userId: string,
    year: number
  ): Promise<void> {
    await prisma.birthday.updateMany({
      where: { guildId, userId },
      data: { lastCelebratedYear: year },
    });
  }

  async setGrantedRole(
    guildId: string,
    userId: string,
    roleId: string | null
  ): Promise<void> {
    await prisma.birthday.updateMany({
      where: { guildId, userId },
      data: { grantedRoleId: roleId },
    });
  }

  async getGrantedRole(
    guildId: string,
    userId: string
  ): Promise<string | null> {
    const row = await prisma.birthday.findUnique({
      where: { guildId_userId: { guildId, userId } },
      select: { grantedRoleId: true },
    });
    return row?.grantedRoleId ?? null;
  }

  async listRoleHolders(guildId: string): Promise<RoleRevocation[]> {
    const rows = await prisma.birthday.findMany({
      where: { guildId, grantedRoleId: { not: null } },
      select: { userId: true, grantedRoleId: true },
    });
    return rows.flatMap(({ userId, grantedRoleId }) =>
      grantedRoleId ? [{ userId, roleId: grantedRoleId }] : []
    );
  }
}

export default declareService(new BirthdayService());
