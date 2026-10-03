import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { declareCommand } from "#lib/command.js";
import type { ConfigProvider } from "#lib/config.js";
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
  guildNow,
} from "#modules/birthday/services/birthday-scheduler.js";
import birthdayService, {
  type UpcomingBirthday,
} from "#modules/birthday/services/birthday.service.js";
import { fetchMember } from "#modules/birthday/services/members.js";
import { Colors } from "#utils/colors.js";

const UPCOMING_SIZE = 10;

const logger = loggerMaker("birthday");

type Config = ConfigProvider<BirthdayConfigSchema>;

async function setBirthday(
  interaction: ChatInputCommandInteraction<"cached" | "raw">,
  config: Config
) {
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
    interaction.user.id,
    date
  );
  logger.info(
    `Birthday ${result} | guildId = ${interaction.guildId} | userId = ${interaction.user.id}`
  );
  await interaction.reply({
    content: config.t("set.done", {
      date: formatBirthday(date, config.locale),
    }),
    flags: MessageFlags.Ephemeral,
  });
  void checkGuild(interaction.guildId);
}

async function removeBirthday(
  interaction: ChatInputCommandInteraction<"cached" | "raw">,
  config: Config
) {
  const removed = await forgetBirthday(
    interaction.guildId,
    interaction.user.id
  );
  await interaction.reply({
    content: config.t(removed ? "remove.done" : "remove.none"),
    flags: MessageFlags.Ephemeral,
  });
}

async function showBirthday(
  interaction: ChatInputCommandInteraction<"cached" | "raw">,
  config: Config
) {
  const user = interaction.options.getUser("member") ?? interaction.user;
  const birthday = await birthdayService.getBirthday(
    interaction.guildId,
    user.id
  );

  await interaction.reply({
    content: birthday
      ? config.t("show.value", {
          user: `<@${user.id}>`,
          date: formatBirthday(birthday, config.locale),
        })
      : config.t("show.none", { user: `<@${user.id}>` }),
    allowedMentions: { parse: [] },
  });
}

async function showUpcoming(
  interaction: ChatInputCommandInteraction<"cached" | "raw">,
  config: Config
) {
  await interaction.deferReply();

  const guild =
    interaction.guild ??
    (await interaction.client.guilds.fetch(interaction.guildId));
  const upcoming: UpcomingBirthday[] = [];
  for (const entry of await birthdayService.getUpcoming(
    interaction.guildId,
    guildNow(config.get("timezone"))
  )) {
    if (upcoming.length === UPCOMING_SIZE) {
      break;
    }
    if (await fetchMember(guild, entry.userId)) {
      upcoming.push(entry);
    } else {
      await birthdayService.removeBirthday(interaction.guildId, entry.userId);
      logger.info(
        `Birthday of a departed member forgotten | guildId = ${interaction.guildId} | userId = ${entry.userId}`
      );
    }
  }

  const notice = timeZoneNotice(config);

  if (upcoming.length === 0) {
    await interaction.editReply({
      content: [config.t("upcoming.empty"), notice]
        .filter((line) => line !== null)
        .join("\n"),
      allowedMentions: { parse: [] },
    });
    return;
  }

  const lines = upcoming.map((entry) =>
    config.t("upcoming.line", {
      user: `<@${entry.userId}>`,
      date: formatBirthday(entry, config.locale),
      when:
        entry.daysUntil === 0
          ? config.t("upcoming.today")
          : config.t("upcoming.in", { count: entry.daysUntil }),
    })
  );

  const embed = new EmbedBuilder()
    .setTitle(config.t("upcoming.title"))
    .setDescription(lines.join("\n"))
    .setColor(Colors.SkyBlue);
  if (notice) {
    embed.setFooter({ text: notice });
  }

  await interaction.editReply({
    embeds: [embed],
    allowedMentions: { parse: [] },
  });
}

export default declareCommand<BirthdayConfigSchema>({
  data: new SlashCommandBuilder()
    .setName("birthday")
    .setDescription("Birthday commands")
    .setDescriptionLocalizations({ fr: "Commandes d'anniversaire" })
    .setContexts([InteractionContextType.Guild])
    .addSubcommand((sub) =>
      addDateOptions(
        sub
          .setName("set")
          .setDescription("Save your birthday")
          .setDescriptionLocalizations({ fr: "Enregistrer votre anniversaire" })
      )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Forget your birthday")
        .setDescriptionLocalizations({ fr: "Oublier votre anniversaire" })
    )
    .addSubcommand((sub) =>
      sub
        .setName("show")
        .setDescription("Show a member's birthday")
        .setDescriptionLocalizations({
          fr: "Afficher l'anniversaire d'un membre",
        })
        .addUserOption((option) =>
          option
            .setName("member")
            .setDescription("Member to look up (defaults to you)")
            .setDescriptionLocalizations({
              fr: "Membre à consulter (vous par défaut)",
            })
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("upcoming")
        .setDescription("List the next birthdays")
        .setDescriptionLocalizations({
          fr: "Lister les prochains anniversaires",
        })
    ),

  async execute(interaction, config) {
    if (!interaction.inGuild()) {
      return;
    }

    switch (interaction.options.getSubcommand()) {
      case "set":
        await setBirthday(interaction, config);
        break;
      case "remove":
        await removeBirthday(interaction, config);
        break;
      case "show":
        await showBirthday(interaction, config);
        break;
      case "upcoming":
        await showUpcoming(interaction, config);
        break;
    }
  },
});
