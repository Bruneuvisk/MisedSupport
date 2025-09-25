import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type Client
} from "discord.js";
import { upsertConfig, getConfig, closeTicket, listMessages, setMacro, removeMacro, listMacros, getTicketByChannel } from "../features/modmail/repo.js";
import { transcriptHtml } from "../features/modmail/transcript.js";
import { Mongo } from "../db/Mongo.js";

export default {
  data: new SlashCommandBuilder()
    .setName("modmail")
    .setDescription("Sistema ModMail")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s =>
      s.setName("setup").setDescription("Define categoria/canal de logs e cargos de staff.")
        .addChannelOption(o => o.setName("categoria").setDescription("Categoria p/ tickets").addChannelTypes(ChannelType.GuildCategory))
        .addChannelOption(o => o.setName("logs").setDescription("Canal p/ logs/transcrições").addChannelTypes(ChannelType.GuildText))
        .addRoleOption(o => o.setName("staff1").setDescription("Cargo de staff"))
        .addRoleOption(o => o.setName("staff2").setDescription("Cargo de staff (opcional)"))
        .addRoleOption(o => o.setName("staff3").setDescription("Cargo de staff (opcional)"))
    )
    .addSubcommand(s =>
      s.setName("status").setDescription("Mostra config atual.")
    )
    .addSubcommand(s =>
      s.setName("close").setDescription("Fecha o ticket do canal atual.")
    )
    .addSubcommandGroup(g =>
      g.setName("macro").setDescription("Respostas rápidas")
        .addSubcommand(s => s.setName("set").setDescription("Cria/atualiza macro")
          .addStringOption(o => o.setName("key").setDescription("chave, ex: saudacao").setRequired(true))
          .addStringOption(o => o.setName("text").setDescription("texto da macro").setRequired(true)))
        .addSubcommand(s => s.setName("remove").setDescription("Remove macro")
          .addStringOption(o => o.setName("key").setDescription("chave").setRequired(true)))
        .addSubcommand(s => s.setName("list").setDescription("Lista macros"))
    )
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.guild) return interaction.reply({ ephemeral: true, content: "Use no servidor." });
    try { Mongo.getDb(); } catch { await Mongo.connect(); }

    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);

    if (!group && sub === "setup") {
      const cat = interaction.options.getChannel("categoria");
      const logs = interaction.options.getChannel("logs");
      const s1 = interaction.options.getRole("staff1");
      const s2 = interaction.options.getRole("staff2");
      const s3 = interaction.options.getRole("staff3");
      const staffRoleIds = [s1?.id, s2?.id, s3?.id].filter(Boolean) as string[];

      const cfg = await upsertConfig(interaction.guild.id, {
        inboxCategoryId: cat?.id ?? null,
        logChannelId: logs?.id ?? null,
        staffRoleIds
      });

      return interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle("ModMail | Configurado")
            .setColor(0x60a5fa)
            .setDescription(
              `Categoria: ${cfg?.inboxCategoryId ? `<#${cfg.inboxCategoryId}>` : "_não definida_"}\n` +
              `Logs: ${cfg?.logChannelId ? `<#${cfg.logChannelId}>` : "_não definido_"}\n` +
              `Staff: ${cfg?.staffRoleIds?.length ? cfg.staffRoleIds.map(id => `<@&${id}>`).join(", ") : "_nenhum_"}`
            )
        ]
      });
    }

    if (!group && sub === "status") {
      const cfg = await getConfig(interaction.guild.id);
      return interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle("ModMail | Status")
            .setColor(0x31c48d)
            .setDescription(
              `Categoria: ${cfg?.inboxCategoryId ? `<#${cfg.inboxCategoryId}>` : "_não definida_"}\n` +
              `Logs: ${cfg?.logChannelId ? `<#${cfg.logChannelId}>` : "_não definido_"}\n` +
              `Staff: ${cfg?.staffRoleIds?.length ? cfg.staffRoleIds.map(id => `<@&${id}>`).join(", ") : "_nenhum_"}`
            )
        ]
      });
    }

    if (!group && sub === "close") {
      const t = await getTicketByChannel(interaction.guild.id, interaction.channelId);
      if (!t || t.status === "closed") {
        return interaction.reply({ ephemeral: true, content: "Este canal não é um ticket aberto." });
      }
      const closed = await closeTicket(interaction.guild.id, t._id!, interaction.user.id);

      // gera transcrição e envia em logs (se tiver)
      const msgs = await listMessages(t._id!);
      const html = transcriptHtml(interaction.guild.name, (await interaction.client.users.fetch(t.userId)).tag, msgs);
      const buffer = Buffer.from(html, "utf-8");

      try {
        const cfg = await getConfig(interaction.guild.id);
        if (cfg?.logChannelId) {
          const ch = interaction.guild.channels.cache.get(cfg.logChannelId);
          if (ch?.isTextBased()) {
            await ch.send({ content: `🗃️ Transcrição do ticket <#${t.channelId}> de <@${t.userId}>`, files: [{ attachment: buffer, name: `transcript-${t.userId}-${Date.now()}.html` }] });
          }
        }
      } catch {}

      // encerra canal
      await interaction.reply({ content: "✅ Ticket fechado. Este canal será deletado em 5s." });

      if (interaction.channel && interaction.channel.isTextBased()) {
        const ch = interaction.channel;
        if ("deletable" in ch && (ch as any).deletable) {
          setTimeout(() => (ch as any).delete().catch(() => {}), 5000);
        }
      }
    }

    if (group === "macro") {
      const sub2 = sub;
      if (sub2 === "set") {
        const key = interaction.options.getString("key", true).trim().toLowerCase();
        const text = interaction.options.getString("text", true);
        await setMacro(interaction.guild.id, key, text);
        return interaction.reply({ ephemeral: true, content: `✅ Macro \`${key}\` salva.` });
      }
      if (sub2 === "remove") {
        const key = interaction.options.getString("key", true).trim().toLowerCase();
        await removeMacro(interaction.guild.id, key);
        return interaction.reply({ ephemeral: true, content: `🗑️ Macro \`${key}\` removida.` });
      }
      if (sub2 === "list") {
        const all = await listMacros(interaction.guild.id);
        return interaction.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setTitle("ModMail | Macros")
              .setColor(0xfbbf24)
              .setDescription(all.length ? all.map(m => `• **${m.key}** → ${m.text.slice(0, 100)}`).join("\n") : "_nenhuma_")
          ]
        });
      }
    }
  }
};
