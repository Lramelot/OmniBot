import { GatewayIntentBits } from "discord.js";
import { loggerMaker } from "#lib/logger.js";
import { defineModule } from "#lib/module.js";
import { birthdayConfigSchema } from "./birthday.config.js";
import birthdayAdminCommand from "./commands/birthday-admin.command.js";
import birthdayCommand from "./commands/birthday.command.js";
import {
  revokeAllRoles,
  startBirthdayScheduler,
} from "./services/birthday-scheduler.js";

const logger = loggerMaker("birthday");

const birthdayModule = defineModule({
  id: "birthday",
  name: "Birthdays",
  description:
    "Members save their birthday; the bot wishes them a happy birthday and can give them a role for the day.",
  version: "1.0.0",
  author: "LoicR",

  config: birthdayConfigSchema,

  intents: [GatewayIntentBits.Guilds],

  onLoad(client, registry) {
    registry.register(birthdayCommand);
    registry.register(birthdayAdminCommand);

    startBirthdayScheduler(client, birthdayModule);
  },

  onInstall(_client, guild) {
    logger.info(`Module installed | guildId = ${guild.id}`);
  },

  onUninstall(_client, guild) {
    logger.info(`Module uninstalled | guildId = ${guild.id}`);
    revokeAllRoles(guild).catch((err: unknown) =>
      logger.error(
        { err },
        `Failed to revoke birthday roles | guildId = ${guild.id}`
      )
    );
  },
});

export default birthdayModule;
