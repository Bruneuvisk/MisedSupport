import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Client
} from "discord.js";

import { applyBackup } from "../utils/applyBackup.js";
import type { GuildSnapshot } from "../../types.js";

export default {
  data: new SlashCommandBuilder()
    .setName("template")
    .setDescription("Templates estilo Xenon.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sc =>
      sc.setName("load")
        .setDescription("Load a template (JSON)")
        .addStringOption(o => o.setName("url").setDescription("URL direta para JSON (raw)"))
    )
    .addSubcommand(sc =>
      sc.setName("help").setDescription("Como usar template load com JSON")
    )
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use este comando dentro de um servidor.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "help") {
      return interaction.reply({
        ephemeral: true,
        content:
          "Para carregar um template do Xenon: obtenha o **JSON exportado** do template (link *raw* ou arquivo `.json`).\n" +
          "Use `/template load url:<link do JSON>` **ou** anexe o arquivo JSON e eu carrego."
      });
    }

    if (sub === "load") {
      await interaction.deferReply({ ephemeral: true });

      let jsonUrl = interaction.options.getString("url") ?? null;
      const att = interaction.options.getAttachment("file" as any);
      if (att?.url) jsonUrl = att.url;

      if (!jsonUrl) {
        return interaction.editReply("Informe uma `url` com JSON do template (ou me envie um anexo `.json`).");
      }

      try {
        const res = await fetch(jsonUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();

        const snap = toGuildSnapshot(raw, interaction.guild.id);
        await applyBackup(interaction.guild, snap);

        return interaction.editReply("✅ Template aplicado com sucesso.");
      } catch (e: any) {
        return interaction.editReply(`❌ Falha ao carregar template: \`${e.message ?? e}\``);
      }
    }
  }
};

// Se o JSON já estiver no formato do GuildSnapshot, só retorne `raw as GuildSnapshot`.
function toGuildSnapshot(raw: any, guildId: string): GuildSnapshot {
  if (raw && raw.roles && raw.channels) {
    return {
      guildId,
      name: raw.name ?? "Template",
      createdAt: new Date(),
      roles: raw.roles ?? [],
      everyone: raw.everyone ?? {
        id: guildId,
        name: "@everyone",
        color: 0,
        hoist: false,
        mentionable: false,
        permissions: "0",
        icon: null,
        unicodeEmoji: null
      },
      categories: raw.categories ?? [],
      channels: raw.channels ?? [],
      note: raw.note ?? "template-import"
    };
  }
  throw new Error("Formato de JSON não reconhecido. Adapte o mapeamento em toGuildSnapshot().");
}
