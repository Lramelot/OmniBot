import {
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { requireAdmin } from "#core/utils/require-admin.js";
import { declareCommand } from "#lib/command.js";
import { loggerMaker } from "#lib/logger.js";
import type { BirthdayConfigSchema } from "#modules/birthday/birthday.config.js";
import {
  addDateOptions,
  formatBirthday,
  readDate,
  timeZoneNotice,
} from "#modules/birthday/commands/birthday-options.js";
import { isValidBirthday } from "#modules/birthday/services/birthday-dates.js";
import {
  checkGuild,
  forgetBirthday,
} from "#modules/birthday/services/birthday-scheduler.js";
import birthdayService from "#modules/birthday/services/birthday.service.js";

const PERMISSION_ADMINISTRATOR = 0x8;

const logger = loggerMaker("birthday");

export default declareCommand<BirthdayConfigSchema>({
  data: new SlashCommandBuilder()
    .setName("birthday-admin")
    .setDescription("Birthday admin commands")
    .setDescriptionLocalizations({ fr: "Administration des anniversaires" })
    .setDefaultMemberPermissions(PERMISSION_ADMINISTRATOR)
    .setContexts([InteractionContextType.Guild])
    .addSubcommand((sub) =>
      addDateOptions(
        sub
          .setName("set")
          .setDescription("Set a member's birthday")
          .setDescriptionLocalizations({
            fr: "Définir l'anniversaire d'un membre",
          })
          .addUserOption((option) =>
            option
              .setName("member")
              .setDescription("Member whose birthday to set")
              .setDescriptionLocalizations({
                fr: "Membre dont définir l'anniversaire",
              })
              .setRequired(true)
          )
      )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a member's birthday")
        .setDescriptionLocalizations({
          fr: "Supprimer l'anniversaire d'un membre",
        })
        .addUserOption((option) =>
          option
            .setName("member")
            .setDescription("Member whose birthday to remove")
            .setDescriptionLocalizations({
              fr: "Membre dont supprimer l'anniversaire",
            })
            .setRequired(true)
        )
    ),

  async execute(interaction, config) {
    if (!interaction.inGuild()) {
      return;
    }
    if (!(await requireAdmin(interaction, config.t))) {
      return;
    }

    const member = interaction.options.getUser("member", true);
    const mention = `<@${member.id}>`;

    switch (interaction.options.getSubcommand()) {
      case "set": {
        const date = readDate(interaction);
        if (!isValidBirthday(date)) {
          await interaction.reply({
            content: config.t("invalidDate"),
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const result = await birthdayService.setBirthday(
          interaction.guildId,
          member.id,
          date
        );
        logger.info(
          `Birthday ${result} | guildId = ${interaction.guildId} | userId = ${member.id} | by = ${interaction.user.id}`
        );
        await interaction.reply({
          content: [
            config.t("admin.set.done", {
              user: mention,
              date: formatBirthday(date, config.locale),
            }),
            timeZoneNotice(config),
          ]
            .filter((line) => line !== null)
            .join("\n"),
          flags: MessageFlags.Ephemeral,
        });
        void checkGuild(interaction.guildId);
        break;
      }
      case "remove": {
        const removed = await forgetBirthday(interaction.guildId, member.id);
        if (removed) {
          logger.info(
            `Birthday removed | guildId = ${interaction.guildId} | userId = ${member.id} | by = ${interaction.user.id}`
          );
        }
        await interaction.reply({
          content: config.t(
            removed ? "admin.remove.done" : "admin.remove.none",
            { user: mention }
          ),
          flags: MessageFlags.Ephemeral,
        });
        break;
      }
    }
  },
});
