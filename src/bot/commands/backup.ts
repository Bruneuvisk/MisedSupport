import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  type Client
} from "discord.js";

import { createBackup, listBackups, findBackupById } from "../repos/backupRepo.js";
import { upsertSchedule, getSchedule } from "../repos/scheduleRepo.js";
import { snapshotGuild } from "../utils/snapshot.js";
import { applyBackup } from "../utils/applyBackup.js";
import type { BackupDoc, BackupScheduleDoc } from "../../types.js";

export default {
  // seu loader espera .toJSON() aqui
  data: new SlashCommandBuilder()
    .setName("backup")
    .setDescription("Backup do servidor (estilo Xenon).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sc =>
      sc.setName("create")
        .setDescription("Create a backup")
        .addStringOption(o => o.setName("label").setDescription("Rótulo do backup (opcional)"))
    )
    .addSubcommand(sc =>
      sc.setName("load")
        .setDescription("Load a previously created backup")
        .addStringOption(o => o.setName("id").setDescription("ID do backup").setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName("list")
        .setDescription("List all your backups")
    )
    .addSubcommandGroup(g =>
      g.setName("interval")
        .setDescription("Manage automated backups")
        .addSubcommand(sc =>
          sc.setName("set")
            .setDescription("Define o intervalo automatizado")
            .addStringOption(o =>
              o.setName("mode")
                .setDescription("hourly, daily, weekly, off")
                .setRequired(true)
                .addChoices(
                  { name: "off", value: "off" },
                  { name: "hourly", value: "hourly" },
                  { name: "daily", value: "daily" },
                  { name: "weekly", value: "weekly" }
                )
            )
            .addIntegerOption(o => o.setName("hour_utc").setDescription("0–23 (necessário p/ daily/weekly)"))
            .addIntegerOption(o => o.setName("weekday_utc").setDescription("0=Dom ... 6=Sáb (necessário p/ weekly)"))
            .addStringOption(o => o.setName("label").setDescription("Rótulo p/ backups automáticos"))
        )
        .addSubcommand(sc => sc.setName("status").setDescription("Mostra configuração atual"))
    )
    .toJSON(),

  // seu executor padrão
  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use este comando dentro de um servidor.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);

    // /backup list
    if (sub === "list" && !group) {
      const items = await listBackups(interaction.guild.id, 15);
      if (!items.length) {
        return interaction.reply({ content: "Nenhum backup salvo ainda.", ephemeral: true });
        }
      const desc = items
        .map((b: BackupDoc) => {
          const idStr = b._id ? b._id.toHexString() : "(sem id)";
          const ts = Math.floor(new Date(b.createdAt).getTime() / 1000);
          return `**${idStr}** — \`${b.label ?? "sem rótulo"}\` — <t:${ts}:f>`;
        })
        .join("\n");

      const emb = new EmbedBuilder()
        .setTitle("Backups mais recentes")
        .setDescription(desc)
        .setColor(0x00AEEF);

      return interaction.reply({ embeds: [emb], ephemeral: true });
    }

    // /backup create
    if (sub === "create" && !group) {
      await interaction.deferReply({ ephemeral: true });
      const label = interaction.options.getString("label") ?? undefined;
      const snap = await snapshotGuild(interaction.guild, label);
      const saved = await createBackup({
        guildId: interaction.guild.id,
        createdBy: interaction.user.id,
        label,
        snapshot: snap,
        createdAt: new Date()
      });
      return interaction.editReply(
        `Backup criado: **${saved._id?.toHexString()}**${label ? ` (label: \`${label}\`)` : ""}`
      );
    }

    // /backup load
    if (sub === "load" && !group) {
      const id = interaction.options.getString("id", true);
      const found = await findBackupById(interaction.guild.id, id);
      if (!found) {
        return interaction.reply({ content: "Backup não encontrado para este servidor.", ephemeral: true });
      }

      const confirm = new ButtonBuilder()
        .setCustomId(`backup_load_ok_${id}`)
        .setLabel("Carregar backup (pode sobrescrever permissões)")
        .setStyle(ButtonStyle.Danger);
      const cancel = new ButtonBuilder()
        .setCustomId(`backup_load_cancel_${id}`)
        .setLabel("Cancelar")
        .setStyle(ButtonStyle.Secondary);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirm, cancel);

      const ts = Math.floor(new Date(found.createdAt).getTime() / 1000);

      await interaction.reply({
        content:
          `⚠️ **Atenção**: Carregar um backup pode **alterar cargos, categorias, canais e perms**.\n` +
          `Backup: **${id}** (${found.label ?? "sem rótulo"}) criado em <t:${ts}:f>.\nConfirme abaixo:`,
        components: [row],
        ephemeral: true
      });

      const msg = await interaction.fetchReply();
      const col = msg.createMessageComponentCollector({ time: 60_000, filter: i => i.user.id === interaction.user.id });

      col.on("collect", async (i) => {
        if (i.customId === `backup_load_cancel_${id}`) {
          await i.update({ content: "Operação cancelada.", components: [] });
          col.stop("canceled");
          return;
        }
        if (i.customId === `backup_load_ok_${id}`) {
          await i.update({ content: "Aplicando backup… isso pode levar algum tempo.", components: [] });
          try {
            await applyBackup(interaction.guild!, found.snapshot);
            await interaction.followUp({ content: "✅ Backup aplicado com sucesso.", ephemeral: true });
          } catch (e: any) {
            await interaction.followUp({ content: `❌ Falha ao aplicar backup: \`${e.message ?? e}\``, ephemeral: true });
          } finally {
            col.stop("done");
          }
        }
      });

      col.on("end", async (_, reason) => {
        if (reason === "time") {
          try { await interaction.editReply({ content: "Tempo de confirmação esgotado.", components: [] }); } catch {}
        }
      });

      return;
    }

    // /backup interval set|status
    if (group === "interval") {
      const sub2 = sub;

      if (sub2 === "status") {
        const s = await getSchedule(interaction.guild.id);
        if (!s || !s.enabled || s.interval === "off") {
          return interaction.reply({ content: "Automação: **desativada**.", ephemeral: true });
        }
        return interaction.reply({
          content:
            `Automação: **${s.interval}**\n` +
            `Hora(UTC): ${s.hourUTC ?? "-"}\n` +
            `Dia da semana(UTC): ${s.weekdayUTC ?? "-"}\n` +
            `Label: \`${s.label ?? "-"}\``,
          ephemeral: true
        });
      }

      if (sub2 === "set") {
        const mode = interaction.options.getString("mode", true) as BackupScheduleDoc["interval"];
        const hourUTC = interaction.options.getInteger("hour_utc") ?? undefined;
        const weekdayUTC = interaction.options.getInteger("weekday_utc") ?? undefined;
        const label = interaction.options.getString("label") ?? undefined;

        if (mode === "daily" && hourUTC == null)
          return interaction.reply({ content: "Para **daily**, informe `hour_utc` (0–23).", ephemeral: true });
        if (mode === "weekly" && (hourUTC == null || weekdayUTC == null))
          return interaction.reply({ content: "Para **weekly**, informe `hour_utc` (0–23) e `weekday_utc` (0–6).", ephemeral: true });

        const saved = await upsertSchedule({
          guildId: interaction.guild.id,
          interval: mode,
          hourUTC,
          weekdayUTC,
          label,
          enabled: mode !== "off"
        });

        return interaction.reply({
          content: mode === "off"
            ? "Automação **desativada**."
            : `Automação configurada: **${saved?.interval}** (hour=${saved?.hourUTC ?? "-"}, weekday=${saved?.weekdayUTC ?? "-"}) label=\`${saved?.label ?? "-"}\``,
          ephemeral: true
        });
      }
    }
  }
};
