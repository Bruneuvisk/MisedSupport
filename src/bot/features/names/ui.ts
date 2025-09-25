import {
  EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle
} from "discord.js";
import type { NameCategory, NameCategoryConfig } from "./types.js";

export const CATEGORY_LABEL: Record<NameCategory, string> = {
  "4c": "4 Caracteres",
  "3c": "3 Caracteres",
  "real": "Real Words",
  "social": "Social Tags",
  "mixed": "Mixed/Geral"
};

export function makePanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Notificações | Categorias")
    .setDescription(
      "Selecione para quais categorias você quer receber notificações:\n\n" +
      "🧩 **4 Caracteres**\nNotificações para usernames de 4 caracteres\n\n" +
      "🧩 **3 Caracteres**\nNotificações para usernames de 3 caracteres\n\n" +
      "🔤 **Real Words**\nNotificações para usernames que são palavras\n\n" +
      "🏷️ **Social Tags**\nNotificações para usernames de redes sociais\n\n" +
      "✨ **Mixed**\nNotificações gerais/mistas\n\n" +
      "🔔 Selecione uma categoria para ver as opções de notificação"
    )
    .setColor(0x00ff66);
}

export function makeCategorySelect() {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("names:select-category")
      .setPlaceholder("Selecione uma categoria")
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel(CATEGORY_LABEL["4c"]).setValue("4c"),
        new StringSelectMenuOptionBuilder().setLabel(CATEGORY_LABEL["3c"]).setValue("3c"),
        new StringSelectMenuOptionBuilder().setLabel(CATEGORY_LABEL["real"]).setValue("real"),
        new StringSelectMenuOptionBuilder().setLabel(CATEGORY_LABEL["social"]).setValue("social"),
        new StringSelectMenuOptionBuilder().setLabel(CATEGORY_LABEL["mixed"]).setValue("mixed"),
      )
  );
}

export function makeCategoryActions(cfg?: NameCategoryConfig) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("names:toggle")
      .setStyle(cfg?.enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setLabel(cfg?.enabled ? "Ativado" : "Desativado"),
    new ButtonBuilder()
      .setCustomId("names:mentions")
      .setStyle(ButtonStyle.Primary)
      .setLabel("Mentions"),
    new ButtonBuilder()
      .setCustomId("names:setchannel")
      .setStyle(ButtonStyle.Primary)
      .setLabel("Canal"),
    new ButtonBuilder()
      .setCustomId("names:test")
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Testar aviso"),
  );
  return row;
}
