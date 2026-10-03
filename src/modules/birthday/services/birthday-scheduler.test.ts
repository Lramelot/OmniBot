import { DiscordAPIError, RESTJSONErrorCodes } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface BirthdayRow {
  guildId: string;
  userId: string;
  day: number;
  month: number;
  lastCelebratedYear: number | null;
  grantedRoleId: string | null;
}

const rows = new Map<string, BirthdayRow>();
const key = (guildId: string, userId: string) => `${guildId}:${userId}`;
const configValues: Record<string, unknown> = {};

vi.mock("#lib/database.js", () => ({
  default: {
    birthday: {
      async findUnique({
        where,
      }: {
        where: { guildId_userId: { guildId: string; userId: string } };
      }) {
        const { guildId, userId } = where.guildId_userId;
        return rows.get(key(guildId, userId)) ?? null;
      },
      async findMany({
        where,
      }: {
        where: { guildId: string; grantedRoleId?: { not: null } };
      }) {
        return [...rows.values()].filter(
          (row) =>
            row.guildId === where.guildId &&
            (!where.grantedRoleId || row.grantedRoleId !== null)
        );
      },
      async updateMany({
        where,
        data,
      }: {
        where: { guildId: string; userId: string };
        data: Partial<BirthdayRow>;
      }) {
        const row = rows.get(key(where.guildId, where.userId));
        if (row) {
          Object.assign(row, data);
        }
        return { count: row ? 1 : 0 };
      },
      async deleteMany({
        where,
      }: {
        where: { guildId: string; userId: string };
      }) {
        return { count: rows.delete(key(where.guildId, where.userId)) ? 1 : 0 };
      },
    },
  },
}));

vi.mock("#core/services/config.service.js", () => ({
  default: {
    async getConfigForModuleIn() {
      return { locale: "fr", get: (name: string) => configValues[name] };
    },
  },
}));

vi.mock("#core/services/module.service.js", () => ({
  default: { getActivatedGuildIds: async () => [] },
}));

const {
  forgetBirthday,
  formatAnnouncement,
  msUntilNextQuarterHour,
  processGuild,
  revokeAllRoles,
  startBirthdayScheduler,
} = await import("./birthday-scheduler.js");

class FakeMember {
  readonly roles;

  constructor(
    readonly id: string,
    roleIds: string[] = []
  ) {
    const cache = new Set(roleIds);
    this.roles = {
      cache,
      add: vi.fn(async (roleId: string) => void cache.add(roleId)),
      remove: vi.fn(async (roleId: string) => void cache.delete(roleId)),
    };
  }
}

const members = new Map<string, FakeMember>();
const guild = {
  id: "g",
  members: {
    async fetch(userId: string) {
      const member = members.get(userId);
      if (!member) {
        throw new DiscordAPIError(
          { code: RESTJSONErrorCodes.UnknownMember, message: "Unknown Member" },
          RESTJSONErrorCodes.UnknownMember,
          404,
          "GET",
          `/guilds/g/members/${userId}`,
          {}
        );
      }
      return member;
    },
  },
};
const client = { guilds: { cache: new Map([["g", guild]]) } };
const channel = { id: "c", isSendable: () => true, send: vi.fn() };

const run = (iso: string) =>
  processGuild(client as never, {} as never, "g", new Date(iso));

const addBirthday = (userId: string, day: number, month: number) =>
  rows.set(key("g", userId), {
    guildId: "g",
    userId,
    day,
    month,
    lastCelebratedYear: null,
    grantedRoleId: null,
  });

const row = (userId: string) => rows.get(key("g", userId));

beforeEach(() => {
  rows.clear();
  members.clear();
  channel.send.mockReset();
  Object.assign(configValues, {
    channel,
    role: { id: "r1" },
    message: "🎉 Joyeux anniversaire {user} !",
    hour: "09:00",
    timezone: "Europe/Paris",
  });
});

describe("processGuild", () => {
  it("waits for the announcement hour in the guild's time zone", async () => {
    addBirthday("alice", 3, 10);
    members.set("alice", new FakeMember("alice"));

    await run("2026-10-03T06:30:00Z");

    expect(channel.send).not.toHaveBeenCalled();
    expect(row("alice")?.lastCelebratedYear).toBeNull();
  });

  it("grants the role and announces every birthday in one message", async () => {
    addBirthday("alice", 3, 10);
    addBirthday("bob", 3, 10);
    addBirthday("carol", 4, 10);
    const alice = new FakeMember("alice");
    members.set("alice", alice);
    members.set("bob", new FakeMember("bob"));
    members.set("carol", new FakeMember("carol"));

    await run("2026-10-03T08:00:00Z");

    expect(alice.roles.cache.has("r1")).toBe(true);
    expect(row("alice")).toMatchObject({
      lastCelebratedYear: 2026,
      grantedRoleId: "r1",
    });
    expect(row("carol")?.lastCelebratedYear).toBeNull();
    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(channel.send).toHaveBeenCalledWith({
      content: "🎉 Joyeux anniversaire <@alice> et <@bob> !",
      allowedMentions: { parse: [], users: ["alice", "bob"] },
    });
  });

  it("does not announce twice the same day", async () => {
    addBirthday("alice", 3, 10);
    members.set("alice", new FakeMember("alice"));

    await run("2026-10-03T08:00:00Z");
    await run("2026-10-03T08:15:00Z");

    expect(channel.send).toHaveBeenCalledTimes(1);
  });

  it("removes the role once the day is over", async () => {
    addBirthday("alice", 3, 10);
    const alice = new FakeMember("alice");
    members.set("alice", alice);

    await run("2026-10-03T08:00:00Z");
    await run("2026-10-03T22:00:00Z");

    expect(alice.roles.cache.has("r1")).toBe(false);
    expect(row("alice")?.grantedRoleId).toBeNull();
  });

  it("swaps roles when the configured role changes during the day", async () => {
    addBirthday("alice", 3, 10);
    const alice = new FakeMember("alice");
    members.set("alice", alice);

    await run("2026-10-03T08:00:00Z");
    configValues["role"] = { id: "r2" };
    await run("2026-10-03T09:00:00Z");

    expect([...alice.roles.cache]).toEqual(["r2"]);
    expect(row("alice")?.grantedRoleId).toBe("r2");
    expect(channel.send).toHaveBeenCalledTimes(1);
  });

  it("forgets a member who left the server", async () => {
    addBirthday("ghost", 3, 10);

    await run("2026-10-03T08:00:00Z");

    expect(row("ghost")).toBeUndefined();
    expect(channel.send).not.toHaveBeenCalled();
  });

  it("still celebrates when the announcement cannot be sent", async () => {
    addBirthday("alice", 3, 10);
    members.set("alice", new FakeMember("alice"));
    channel.send.mockRejectedValueOnce(new Error("Missing Access"));

    await run("2026-10-03T08:00:00Z");

    expect(row("alice")).toMatchObject({
      lastCelebratedYear: 2026,
      grantedRoleId: "r1",
    });
  });

  it("keeps celebrating without a role nor a channel", async () => {
    addBirthday("alice", 3, 10);
    const alice = new FakeMember("alice");
    members.set("alice", alice);
    configValues["role"] = undefined;
    configValues["channel"] = undefined;

    await run("2026-10-03T08:00:00Z");

    expect(alice.roles.add).not.toHaveBeenCalled();
    expect(row("alice")).toMatchObject({
      lastCelebratedYear: 2026,
      grantedRoleId: null,
    });
  });

  it("falls back to UTC on an invalid time zone", async () => {
    addBirthday("alice", 3, 10);
    members.set("alice", new FakeMember("alice"));
    configValues["timezone"] = "Europe/Nowhere";

    await run("2026-10-03T08:30:00Z");
    expect(channel.send).not.toHaveBeenCalled();

    await run("2026-10-03T09:00:00Z");
    expect(channel.send).toHaveBeenCalledTimes(1);
  });
});

describe("role cleanup", () => {
  it("revokes every granted role when the module is uninstalled", async () => {
    addBirthday("alice", 3, 10);
    const alice = new FakeMember("alice");
    members.set("alice", alice);
    await run("2026-10-03T08:00:00Z");

    await revokeAllRoles(guild as never);

    expect(alice.roles.cache.has("r1")).toBe(false);
    expect(row("alice")?.grantedRoleId).toBeNull();
  });

  it("revokes the role of a member who forgets their birthday", async () => {
    startBirthdayScheduler(client as never, {} as never);
    addBirthday("alice", 3, 10);
    const alice = new FakeMember("alice");
    members.set("alice", alice);
    await run("2026-10-03T08:00:00Z");

    expect(await forgetBirthday("g", "alice")).toBe(true);

    expect(alice.roles.cache.has("r1")).toBe(false);
    expect(row("alice")).toBeUndefined();
  });
});

describe("msUntilNextQuarterHour", () => {
  const at = (iso: string) => new Date(iso).getTime();

  it("waits until the next quarter hour", () => {
    expect(msUntilNextQuarterHour(at("2026-10-03T08:59:00Z"))).toBe(60_000);
    expect(msUntilNextQuarterHour(at("2026-10-03T09:20:30Z"))).toBe(570_000);
  });

  it("waits a full quarter when already on the boundary", () => {
    expect(msUntilNextQuarterHour(at("2026-10-03T09:45:00Z"))).toBe(900_000);
  });
});

describe("formatAnnouncement", () => {
  it("lists every celebrated member in the guild's language", () => {
    expect(formatAnnouncement("Bravo {user}", ["1", "2", "3"], "en")).toBe(
      "Bravo <@1>, <@2>, and <@3>"
    );
    expect(formatAnnouncement("{user} 🎂 {user}", ["1"], "fr")).toBe(
      "<@1> 🎂 <@1>"
    );
  });
});
