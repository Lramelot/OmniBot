import { ConfigType, type ConfigSchema } from "#lib/config.js";

export const ANNOUNCEMENT_HOURS = Array.from(
  { length: 24 },
  (_, hour) => `${String(hour).padStart(2, "0")}:00`
);

export const birthdayConfigSchema = {
  channel: {
    name: "Announcement channel",
    description: "Channel where birthdays are announced.",
    type: ConfigType.CHANNEL,
  },
  role: {
    name: "Birthday role",
    description: "Role given to members for the whole day of their birthday.",
    type: ConfigType.ROLE,
  },
  message: {
    name: "Message",
    description:
      "Announcement message — variable: {user} (the mentions of every member celebrated that day).",
    type: ConfigType.STRING,
    defaultValue: "🎉 Happy birthday {user}!",
  },
  hour: {
    name: "Announcement time",
    description: "Time of day at which birthdays are announced.",
    type: ConfigType.ENUM,
    options: ANNOUNCEMENT_HOURS,
    defaultValue: "09:00",
  },
  timezone: {
    name: "Time zone",
    description:
      "IANA time zone used to decide when a day starts, e.g. Europe/Paris.",
    type: ConfigType.STRING,
    defaultValue: "Europe/Paris",
  },
} satisfies ConfigSchema;

export type BirthdayConfigSchema = typeof birthdayConfigSchema;
