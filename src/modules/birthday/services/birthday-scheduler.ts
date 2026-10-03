import type { Client, Guild, GuildMember } from "discord.js";
import { loggerMaker } from "#lib/logger.js";
import type { Module } from "#lib/module.js";
import type { BirthdayConfigSchema } from "#modules/birthday/birthday.config.js";
import {
  isValidTimeZone,
  localDateTime,
  parseAnnouncementHour,
  type LocalDateTime,
} from "./birthday-dates.js";
import birthdayService from "./birthday.service.js";
import { planCelebrations } from "./celebration-plan.js";
import { fetchMember } from "./members.js";

const QUARTER_HOUR_MS = 15 * 60 * 1000;

const logger = loggerMaker("birthday");

const reportedTimeZones = new Set<string>();

export function guildNow(timeZone: string, now = new Date()): LocalDateTime {
  if (!isValidTimeZone(timeZone)) {
    if (!reportedTimeZones.has(timeZone)) {
      reportedTimeZones.add(timeZone);
      logger.warn(
        `Invalid time zone, falling back to UTC | timeZone = ${timeZone}`
      );
    }
    return localDateTime(now, "UTC");
  }
  return localDateTime(now, timeZone);
}

export function formatAnnouncement(
  template: string,
  userIds: readonly string[],
  locale: string
): string {
  const mentions = new Intl.ListFormat(locale, { type: "conjunction" }).format(
    userIds.map((userId) => `<@${userId}>`)
  );
  return template.replaceAll("{user}", mentions);
}

async function forgetDeparted(guildId: string, userId: string) {
  await birthdayService.removeBirthday(guildId, userId);
  logger.info(
    `Birthday of a departed member forgotten | guildId = ${guildId} | userId = ${userId}`
  );
}

async function revokeRole(guild: Guild, userId: string, roleId: string) {
  const member = await fetchMember(guild, userId);
  if (!member) {
    await forgetDeparted(guild.id, userId);
    return;
  }
  if (member.roles.cache.has(roleId)) {
    await member.roles.remove(roleId);
  }
  await birthdayService.setGrantedRole(guild.id, userId, null);
}

async function grantRole(guildId: string, member: GuildMember, roleId: string) {
  try {
    await member.roles.add(roleId);
    await birthdayService.setGrantedRole(guildId, member.id, roleId);
  } catch (err) {
    logger.warn(
      { err },
      `Could not grant the birthday role | guildId = ${guildId} | userId = ${member.id}`
    );
  }
}

export async function processGuild(
  client: Client,
  module: Module<BirthdayConfigSchema>,
  guildId: string,
  now = new Date()
): Promise<void> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return;
  }

  const { default: configService } =
    await import("#core/services/config.service.js");
  const config = await configService.getConfigForModuleIn(module, guildId);
  const today = guildNow(config.get("timezone"), now);
  const roleId = config.get("role")?.id ?? null;
  const plan = planCelebrations(
    await birthdayService.listBirthdays(guildId),
    today,
    parseAnnouncementHour(config.get("hour")),
    roleId
  );

  for (const revocation of plan.revoke) {
    try {
      await revokeRole(guild, revocation.userId, revocation.roleId);
    } catch (err) {
      logger.warn(
        { err },
        `Could not revoke the birthday role | guildId = ${guildId} | userId = ${revocation.userId}`
      );
    }
  }

  if (roleId) {
    for (const userId of plan.regrant) {
      const member = await fetchMember(guild, userId).catch(() => null);
      if (member) {
        await grantRole(guildId, member, roleId);
      }
    }
  }

  const celebrated: string[] = [];
  for (const userId of plan.celebrate) {
    try {
      const member = await fetchMember(guild, userId);
      if (!member) {
        await forgetDeparted(guildId, userId);
        continue;
      }
      await birthdayService.markCelebrated(guildId, userId, today.year);
      if (roleId) {
        await grantRole(guildId, member, roleId);
      }
      celebrated.push(userId);
      logger.info(
        `Birthday celebrated | guildId = ${guildId} | userId = ${userId}`
      );
    } catch (err) {
      logger.error(
        { err },
        `Failed to celebrate a birthday | guildId = ${guildId} | userId = ${userId}`
      );
    }
  }

  const channel = config.get("channel");
  if (celebrated.length === 0 || !channel?.isSendable()) {
    return;
  }
  try {
    await channel.send({
      content: formatAnnouncement(
        config.get("message"),
        celebrated,
        config.locale
      ),
      allowedMentions: { parse: [], users: celebrated },
    });
  } catch (err) {
    logger.error(
      { err },
      `Failed to announce birthdays | guildId = ${guildId} | channelId = ${channel.id}`
    );
  }
}

let queue: Promise<unknown> = Promise.resolve();
let context: {
  client: Client;
  module: Module<BirthdayConfigSchema>;
} | null = null;

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

export function msUntilNextQuarterHour(now: number): number {
  return QUARTER_HOUR_MS - (now % QUARTER_HOUR_MS);
}

export function revokeAllRoles(guild: Guild): Promise<void> {
  return enqueue(async () => {
    for (const { userId, roleId } of await birthdayService.listRoleHolders(
      guild.id
    )) {
      await revokeRole(guild, userId, roleId).catch((err: unknown) =>
        logger.warn(
          { err },
          `Could not revoke the birthday role | guildId = ${guild.id} | userId = ${userId}`
        )
      );
    }
  });
}

export function checkGuild(guildId: string): Promise<void> {
  if (!context) {
    return Promise.resolve();
  }
  const { client, module } = context;
  return enqueue(() => processGuild(client, module, guildId)).catch(
    (err: unknown) =>
      logger.warn({ err }, `Birthday check failed | guildId = ${guildId}`)
  );
}

export function forgetBirthday(
  guildId: string,
  userId: string
): Promise<boolean> {
  return enqueue(async () => {
    const roleId = await birthdayService.getGrantedRole(guildId, userId);
    const guild = context?.client.guilds.cache.get(guildId);
    if (roleId && guild) {
      try {
        const member = await fetchMember(guild, userId);
        if (member?.roles.cache.has(roleId)) {
          await member.roles.remove(roleId);
        }
      } catch (err) {
        logger.warn(
          { err },
          `Could not revoke the birthday role | guildId = ${guildId} | userId = ${userId}`
        );
      }
    }
    return birthdayService.removeBirthday(guildId, userId);
  });
}

async function checkAllGuilds(
  client: Client,
  module: Module<BirthdayConfigSchema>,
  now: Date
): Promise<void> {
  const { default: moduleService } =
    await import("#core/services/module.service.js");
  for (const guildId of await moduleService.getActivatedGuildIds(module.id)) {
    try {
      await processGuild(client, module, guildId, now);
    } catch (err) {
      logger.warn({ err }, `Birthday check failed | guildId = ${guildId}`);
    }
  }
}

export function startBirthdayScheduler(
  client: Client,
  module: Module<BirthdayConfigSchema>
): void {
  context = { client, module };

  const run = (now: Date) =>
    enqueue(() => checkAllGuilds(client, module, now)).catch((err: unknown) =>
      logger.error({ err }, "Birthday check failed")
    );

  const scheduleNext = () => {
    const delay = msUntilNextQuarterHour(Date.now());
    const target = Date.now() + delay;
    setTimeout(() => {
      void run(new Date(Math.max(Date.now(), target)));
      scheduleNext();
    }, delay).unref();
  };

  void run(new Date());
  scheduleNext();
}
