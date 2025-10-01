import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import { AfkDao } from "../db/AfkDao.js";

// util simples p/ duração
function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (r || parts.length === 0) parts.push(`${r}s`);
  return parts.join(" ");
}

export default {
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Sistema AFK (avisa quando mencionarem você).")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand(sc =>
      sc
        .setName("ligar")
        .setDescription("Ative o modo AFK para avisar os outros.")
        .addStringOption(o =>
          o.setName("motivo").setDescription("Motivo do AFK (opcional)").setRequired(false)
        )
    )
    .addSubcommand(sc =>
      sc
        .setName("desligar")
        .setDescription("Desative o modo AFK.")
    )
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.isChatInputCommand()) return;
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: "❌ Use isso dentro de uma guild.", ephemeral: true });
      return;
    }

    if (sub === "ligar") {
      const reason = interaction.options.getString("motivo") ?? undefined;

      // tentar prefixar nick com [AFK] (se possível)
      let oldNick: string | null | undefined = undefined;
      try {
        const member = await guild.members.fetch(interaction.user.id);
        oldNick = member.nickname ?? null;
        if (member.manageable) {
          const newNick = member.displayName.startsWith("[AFK] ")
            ? member.displayName
            : `[AFK] ${member.displayName}`.slice(0, 32); // limite de 32 chars
          await member.setNickname(newNick, "AFK ligado");
        }
      } catch {
        // sem permissão, ignore silenciosamente
      }

      await AfkDao.setAfk(guild.id, interaction.user.id, reason, oldNick);

      await interaction.reply(
        `✅ AFK ligado. ${reason ? `Motivo: **${reason}**` : ""} (use \`/afk desligar\` para voltar)`
      );
      return;
    }

    if (sub === "desligar") {
      const removed = await AfkDao.clearAfk(guild.id, interaction.user.id);

      // tentar restaurar apelido anterior
      if (removed) {
        try {
          const member = await guild.members.fetch(interaction.user.id);
          if (member.manageable) {
            const hadPrefix = member.displayName.startsWith("[AFK] ");
            if (hadPrefix) {
              const target = removed.oldNick ?? null;
              await member.setNickname(target, "AFK desligado");
            }
          }
        } catch {
          // sem permissão, ignore
        }
      }

      const since = removed?.since ? ` (ficou AFK por ${fmtDuration(Date.now() - removed.since.getTime())})` : "";
      await interaction.reply(`🟢 AFK desligado.${since}`);
      return;
    }
  },
};
