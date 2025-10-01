import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import { NotifyDao, Platform } from "../db/NotifyDao.js";
import { runNotifyTick } from "../notify/poller.js";
const tplHelp = "Use {name} {title} {url} {id} {platform}";

export default {
  data: new SlashCommandBuilder()
    .setName("notify")
    .setDescription("Gerencia as notificações (tipo NotifyMe).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(sc =>
      sc.setName("setchannel")
        .setDescription("Define o canal de notificações.")
        .addChannelOption(o =>
          o.setName("canal").setDescription("Canal de destino").addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand(sc =>
      sc.setName("enable")
        .setDescription("Liga/desliga o sistema.")
        .addBooleanOption(o => o.setName("on").setDescription("Ativar?").setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName("interval")
        .setDescription("Define intervalo (segundos) do poller.")
        .addIntegerOption(o =>
        o
        .setName("segundos")
        .setDescription("Intervalo em segundos (30–3600)")
        .setMinValue(30)
        .setMaxValue(3600)
        .setRequired(true)
    )
    )
    .addSubcommand(sc =>
      sc.setName("add")
        .setDescription("Adiciona uma fonte.")
        .addStringOption(o => o.setName("plataforma").setDescription("youtube|twitch").setRequired(true))
        .addStringOption(o => o.setName("id").setDescription("YouTube: channel_id | Twitch: login").setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName("remove")
        .setDescription("Remove uma fonte.")
        .addStringOption(o => o.setName("plataforma").setDescription("youtube|twitch").setRequired(true))
        .addStringOption(o => o.setName("id").setDescription("ID da fonte").setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName("list")
        .setDescription("Lista todas as fontes cadastradas.")
    )
    .addSubcommand(sc =>
      sc.setName("pause")
        .setDescription("Pausa uma fonte.")
        .addStringOption(o => o.setName("plataforma").setDescription("youtube|twitch").setRequired(true))
        .addStringOption(o => o.setName("id").setDescription("ID da fonte").setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName("resume")
        .setDescription("Retoma uma fonte.")
        .addStringOption(o => o.setName("plataforma").setDescription("youtube|twitch").setRequired(true))
        .addStringOption(o => o.setName("id").setDescription("ID da fonte").setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName("template")
        .setDescription("Define template da guild ou da fonte.")
        .addStringOption(o => o.setName("template").setDescription(tplHelp).setRequired(true))
        .addStringOption(o => o.setName("plataforma").setDescription("Opcional: youtube|twitch"))
        .addStringOption(o => o.setName("id").setDescription("Opcional: ID da fonte"))
    )
    .addSubcommand(sc =>
      sc.setName("test")
        .setDescription("Faz um tick manual agora.")
    )
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.isChatInputCommand()) return;
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild!;
    await interaction.deferReply({ ephemeral: true });

    if (sub === "setchannel") {
      const ch = interaction.options.getChannel("canal", true);
      await NotifyDao.setGuildCfg(guild.id, { channelId: ch.id, enabled: true });
      await interaction.editReply(`✅ Canal de notificações definido: ${ch}`);
      return;
    }

    if (sub === "enable") {
      const on = interaction.options.getBoolean("on", true);
      await NotifyDao.setGuildCfg(guild.id, { enabled: on });
      await interaction.editReply(on ? "✅ Sistema **ativado**." : "🛑 Sistema **desativado**.");
      return;
    }

    if (sub === "interval") {
      const s = interaction.options.getInteger("segundos", true);
      await NotifyDao.setGuildCfg(guild.id, { intervalSec: s });
      await interaction.editReply(`⏱️ Intervalo salvo: **${s}s** (o scheduler usa um loop global de ~60s).`);
      return;
    }

    if (sub === "add") {
      const platform = interaction.options.getString("plataforma", true).toLowerCase() as Platform;
      const id = interaction.options.getString("id", true).trim();
      if (!["youtube", "twitch"].includes(platform)) {
        await interaction.editReply("Plataforma inválida. Use `youtube` ou `twitch`.");
        return;
      }
      const doc = await NotifyDao.addSub(guild.id, platform, id);
      await interaction.editReply(`✅ Fonte adicionada: **${platform}** → \`${id}\``);
      return;
    }

    if (sub === "remove") {
      const platform = interaction.options.getString("plataforma", true).toLowerCase() as Platform;
      const id = interaction.options.getString("id", true).trim();
      await NotifyDao.removeSub(guild.id, platform, id);
      await interaction.editReply(`🗑️ Removido: **${platform}** → \`${id}\``);
      return;
    }

    if (sub === "list") {
      const subs = await NotifyDao.listSubs(guild.id);
      if (!subs.length) { await interaction.editReply("Sem fontes cadastradas."); return; }
      const lines = subs.map(s => `• ${s.enabled ? "🟢" : "⏸️"} **${s.platform}** → \`${s.sourceId}\``);
      await interaction.editReply(lines.join("\n"));
      return;
    }

    if (sub === "pause" || sub === "resume") {
      const platform = interaction.options.getString("plataforma", true).toLowerCase() as Platform;
      const id = interaction.options.getString("id", true).trim();
      await NotifyDao.setSubEnabled(guild.id, platform, id, sub === "resume");
      await interaction.editReply(`${sub === "resume" ? "▶️ Retomado" : "⏸️ Pausado"}: **${platform}** → \`${id}\``);
      return;
    }

    if (sub === "template") {
      const tpl = interaction.options.getString("template", true);
      const platform = interaction.options.getString("plataforma") as Platform | null;
      const id = interaction.options.getString("id");

      if (platform && id) {
        await NotifyDao.setSubTemplate(guild.id, platform, id, tpl);
        await interaction.editReply(`📝 Template salvo para **${platform}:${id}**.`);
      } else {
        await NotifyDao.setGuildCfg(guild.id, { template: tpl });
        await interaction.editReply("📝 Template padrão da guild salvo.");
      }
      return;
    }

    if (sub === "test") {
      await runNotifyTick(interaction.client);
      await interaction.editReply("✅ Tick executado.");
      return;
    }
  },
};
