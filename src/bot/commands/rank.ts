import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  PermissionFlagsBits,
  User,
} from "discord.js";
import { LevelingDao } from "../db/LevelingDao.js";
import { xpForNextLevel } from "../utils/leveling.js";

export default {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Mostra seu nível e XP atual.")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addUserOption(o => o.setName("user").setDescription("Ver rank de outro usuário").setRequired(false))
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.isChatInputCommand()) return;
    const guild = interaction.guild!;
    const target = interaction.options.getUser("user") ?? interaction.user;

    const doc = await LevelingDao.getUser(guild.id, target.id);
    const level = doc?.level ?? 0;
    const xp = doc?.xp ?? 0;
    const needed = xpForNextLevel(level);

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${target.username}`, iconURL: target.displayAvatarURL() })
      .setTitle(`🏅 Rank`)
      .setDescription(`**Level:** ${level}\n**XP:** ${xp} / ${needed} (falta ${needed - xp})`)
      .setColor(0x5865F2);

    await interaction.reply({ embeds: [embed] });
  },
};
