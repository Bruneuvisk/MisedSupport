import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { LevelingDao } from "../db/LevelingDao.js";

export default {
  data: new SlashCommandBuilder()
    .setName("level")
    .setDescription("Configurações e administração do sistema de níveis.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // /level config
    .addSubcommand(sc =>
      sc.setName("config")
        .setDescription("Define parâmetros do XP.")
        .addIntegerOption(o => o.setName("xpmin").setDescription("Mínimo por mensagem (default 15)").setMinValue(1))
        .addIntegerOption(o => o.setName("xpmax").setDescription("Máximo por mensagem (default 25)").setMinValue(1))
        .addIntegerOption(o => o.setName("cooldown").setDescription("Cooldown em segundos (default 60)").setMinValue(5))
        .addBooleanOption(o => o.setName("anunciar").setDescription("Anunciar level up? (default true)"))
    )

    // /level rewards set
    .addSubcommand(sc =>
      sc.setName("rewards-set")
        .setDescription("Define um cargo para um nível.")
        .addIntegerOption(o => o.setName("level").setDescription("Nível alvo").setRequired(true).setMinValue(1))
        .addRoleOption(o => o.setName("cargo").setDescription("Cargo para atribuir no level").setRequired(true))
    )

    // /level rewards del
    .addSubcommand(sc =>
      sc.setName("rewards-del")
        .setDescription("Remove a recompensa de um nível.")
        .addIntegerOption(o => o.setName("level").setDescription("Nível").setRequired(true).setMinValue(1))
    )

    // /level rewards list
    .addSubcommand(sc =>
      sc.setName("rewards-list")
        .setDescription("Lista recompensas configuradas.")
    )

    // /level givexp
    .addSubcommand(sc =>
      sc.setName("givexp")
        .setDescription("Dá XP a um usuário.")
        .addUserOption(o => o.setName("user").setDescription("Usuário").setRequired(true))
        .addIntegerOption(o => o.setName("xp").setDescription("Quantidade de XP").setRequired(true).setMinValue(1))
    )

    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.isChatInputCommand()) return;
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild!;
    await interaction.deferReply({ ephemeral: true });

    // /level config
    if (sub === "config") {
      const xpMin = interaction.options.getInteger("xpmin") ?? undefined;
      const xpMax = interaction.options.getInteger("xpmax") ?? undefined;
      const cooldownSec = interaction.options.getInteger("cooldown") ?? undefined;
      const announceLevelUp = interaction.options.getBoolean("anunciar") ?? undefined;

      if (xpMin !== undefined && xpMax !== undefined && xpMin > xpMax) {
        await interaction.editReply("❌ `xpmin` não pode ser maior que `xpmax`.");
        return;
      }

      const cfg = await LevelingDao.setConfig(guild.id, { xpMin, xpMax, cooldownSec, announceLevelUp });
      await interaction.editReply(
        `✅ Config salvo: min=${cfg?.xpMin} max=${cfg?.xpMax} cd=${cfg?.cooldownSec}s anunciar=${cfg?.announceLevelUp}`
      );
      return;
    }

    // /level rewards-set
    if (sub === "rewards-set") {
      const level = interaction.options.getInteger("level", true);
      const role = interaction.options.getRole("cargo", true);
      await LevelingDao.setReward(guild.id, level, role.id);
      await interaction.editReply(`✅ Recompensa: nível **${level}** ⇒ cargo <@&${role.id}>.`);
      return;
    }

    // /level rewards-del
    if (sub === "rewards-del") {
      const level = interaction.options.getInteger("level", true);
      await LevelingDao.deleteReward(guild.id, level);
      await interaction.editReply(`🗑️ Removida recompensa do nível **${level}**.`);
      return;
    }

    // /level rewards-list
    if (sub === "rewards-list") {
      const list = await LevelingDao.listRewards(guild.id);
      if (!list.length) {
        await interaction.editReply("Nenhuma recompensa configurada.");
        return;
      }
      const lines = list.map(r => `Nível **${r.level}** ⇒ <@&${r.roleId}>`);
      await interaction.editReply(lines.join("\n"));
      return;
    }

    // /level givexp
    if (sub === "givexp") {
      const user = interaction.options.getUser("user", true);
      const add = interaction.options.getInteger("xp", true);

      const doc = await LevelingDao.getUser(guild.id, user.id) ?? await LevelingDao.upsertUser(guild.id, user.id, {});
      const newXp = (doc?.xp ?? 0) + add;
      await LevelingDao.setUser(guild.id, user.id, { xp: newXp });

      await interaction.editReply(`✅ Adicionado **${add} XP** para \`${user.tag}\`. Total agora: **${newXp}** XP.`);
      return;
    }
  },
};
