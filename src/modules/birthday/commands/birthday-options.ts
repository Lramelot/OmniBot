import type {
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import type { ConfigProvider } from "#lib/config.js";
import type { BirthdayConfigSchema } from "#modules/birthday/birthday.config.js";
import {
  isValidTimeZone,
  type BirthdayDate,
} from "#modules/birthday/services/birthday-dates.js";

const MONTHS: readonly [string, string][] = [
  ["January", "Janvier"],
  ["February", "Février"],
  ["March", "Mars"],
  ["April", "Avril"],
  ["May", "Mai"],
  ["June", "Juin"],
  ["July", "Juillet"],
  ["August", "Août"],
  ["September", "Septembre"],
  ["October", "Octobre"],
  ["November", "Novembre"],
  ["December", "Décembre"],
];

export function addDateOptions(
  sub: SlashCommandSubcommandBuilder
): SlashCommandSubcommandBuilder {
  return sub
    .addIntegerOption((option) =>
      option
        .setName("day")
        .setDescription("Day of the month")
        .setDescriptionLocalizations({ fr: "Jour du mois" })
        .setMinValue(1)
        .setMaxValue(31)
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("month")
        .setDescription("Month")
        .setDescriptionLocalizations({ fr: "Mois" })
        .setRequired(true)
        .addChoices(
          ...MONTHS.map(([en, fr], index) => ({
            name: en,
            name_localizations: { fr },
            value: index + 1,
          }))
        )
    );
}

export function readDate(
  interaction: ChatInputCommandInteraction
): BirthdayDate {
  return {
    day: interaction.options.getInteger("day", true),
    month: interaction.options.getInteger("month", true),
  };
}

export function timeZoneNotice(
  config: ConfigProvider<BirthdayConfigSchema>
): string | null {
  const timeZone = config.get("timezone");
  return isValidTimeZone(timeZone)
    ? null
    : config.t("invalidTimeZone", { timeZone });
}

export function formatBirthday({ day, month }: BirthdayDate, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(Date.UTC(2000, month - 1, day));
}
