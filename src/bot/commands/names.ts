import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  type ChatInputCommandInteraction,
  type Client,
  type GuildTextBasedChannel
} from "discord.js";

import { Mongo } from "../db/Mongo.js";
import { makePanelEmbed, makeCategorySelect, CATEGORY_LABEL } from "../features/names/ui.js";
import { addMentionRole, listConfigs, removeMentionRole, setChannel, setEnabled, upsertCategoryConfig, getCategoryConfig } from "../features/names/repo.js";
import type { NameCategory, NameFoundEvent } from "../features/names/types.js";

export default {
  data: new SlashCommandBuilder()
    .setName("names")
    .setDescription("Notificações de usernames disponíveis.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s =>
      s.setName("painel").setDescription("Publica o painel de categorias no canal atual.")
    )
    .addSubcommand(s =>
      s.setName("config")
       .setDescription("Configurações por categoria.")
       .addStringOption(o =>
          o.setName("categoria").setDescription("4c, 3c, real, social, mixed").setRequired(true)
            .addChoices(
              { name: "4c", value: "4c" }, { name: "3c", value: "3c" },
              { name: "real", value: "real" }, { name: "social", value: "social" },
              { name: "mixed", value: "mixed" }
            )
        )
       .addChannelOption(o =>
          o.setName("canal").setDescription("Canal para avisos desta categoria").addChannelTypes(ChannelType.GuildText)
        )
       .addRoleOption(o =>
          o.setName("add_mention").setDescription("Adicionar cargo para mencionar")
        )
       .addRoleOption(o =>
          o.setName("rem_mention").setDescription("Remover cargo de menção")
        )
       .addBooleanOption(o =>
          o.setName("enabled").setDescription("Ativar/Desativar avisos da categoria")
        )
    )
    .addSubcommand(s =>
      s.setName("notify")
        .setDescription("Dispara um aviso manual (ou pelo seu job).")
        .addStringOption(o => o.setName("categoria").setDescription("4c, 3c, real, social, mixed").setRequired(true)
          .addChoices(
            { name: "4c", value: "4c" }, { name: "3c", value: "3c" },
            { name: "real", value: "real" }, { name: "social", value: "social" },
            { name: "mixed", value: "mixed" }
          ))
        .addStringOption(o => o.setName("username").setDescription("@ sem o arroba (ex: 1uqc)").setRequired(true))
        .addStringOption(o => o.setName("source").setDescription("Origem/scan"))
        .addStringOption(o => o.setName("extra").setDescription("Observações"))
    )
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.guild) return interaction.reply({ ephemeral: true, content: "Use no servidor." });

    // garante Mongo
    try { Mongo.getDb(); } catch { await Mongo.connect(); }

    const sub = interaction.options.getSubcommand();

    if (sub === "painel") {
      const embed = makePanelEmbed();
      const row = makeCategorySelect();
      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    if (sub === "config") {
      const category = interaction.options.getString("categoria", true) as NameCategory;
      const channel = interaction.options.getChannel("canal");
      const addRole = interaction.options.getRole("add_mention");
      const remRole = interaction.options.getRole("rem_mention");
      const enabled = interaction.options.getBoolean("enabled");

      // upsert base
      await upsertCategoryConfig(interaction.guild.id, category, {});
      if (channel) await setChannel(interaction.guild.id, category, channel.id);
      if (addRole) await addMentionRole(interaction.guild.id, category, addRole.id);
      if (remRole) await removeMentionRole(interaction.guild.id, category, remRole.id);
      if (enabled != null) await setEnabled(interaction.guild.id, category, enabled);

      const all = await listConfigs(interaction.guild.id);
      const cfg = all.find(c => c.category === category);

      await interaction.reply({
        ephemeral: true,
        content:
          `✅ **${CATEGORY_LABEL[category]}** atualizado.\n` +
          `Canal: ${cfg?.channelId ? `<#${cfg.channelId}>` : "_não definido_"}\n` +
          `Mentions: ${cfg?.mentionRoleIds?.length ? cfg.mentionRoleIds.map(id => `<@&${id}>`).join(", ") : "_nenhum_"}\n` +
          `Status: **${cfg?.enabled ? "Ativado" : "Desativado"}**`
      });
      return;
    }

    if (sub === "notify") {
      const ev: NameFoundEvent = {
        guildId: interaction.guild.id,
        category: interaction.options.getString("categoria", true) as NameCategory,
        username: interaction.options.getString("username", true),
        source: interaction.options.getString("source") ?? undefined,
        extra: interaction.options.getString("extra") ?? undefined,
        time: new Date()
      };

      const cfg = await getCategoryConfig(ev.guildId, ev.category);
      if (!cfg || !cfg.enabled || !cfg.channelId) {
        return interaction.reply({ ephemeral: true, content: "Categoria sem canal configurado ou desativada." });
      }

      const chan = interaction.guild.channels.cache.get(cfg.channelId) as GuildTextBasedChannel | undefined;
      if (!chan) return interaction.reply({ ephemeral: true, content: "Canal salvo não existe mais." });

      const mentionText = (cfg.mentionRoleIds ?? []).map(id => `<@&${id}>`).join(" ");
      await chan.send({
        content: [
          mentionText || null,
          `• **User ${ev.category} livre:** \`${ev.username}\``,
          `• notify: ${mentionText || "_sem mentions_"}`
        ].filter(Boolean).join("\n")
      });

      return interaction.reply({ ephemeral: true, content: "✅ Aviso enviado." });
    }
  }
};
