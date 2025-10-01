import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { LevelingDao } from "../db/LevelingDao.js";

export default {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Mostra o topo do servidor por XP.")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addIntegerOption(o =>
      o.setName("limite").setDescription("Quantidade (1-25)").setMinValue(1).setMaxValue(25)
    )
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.isChatInputCommand()) return;
    const guild = interaction.guild!;
    const limit = interaction.options.getInteger("limite") ?? 10;

    const top = await LevelingDao.top(guild.id, limit);
    if (!top.length) {
      await interaction.reply("Ninguém tem XP ainda.");
      return;
    }

    const lines = await Promise.all(
      top.map(async (u, i) => {
        const user = await interaction.client.users.fetch(u.userId).catch(() => null);
        const name = user ? user.tag : u.userId;
        return `**${i + 1}.** \`${name}\` — **Lvl ${u.level}** (${u.xp} XP)`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Leaderboard (${limit})`)
      .setDescription(lines.join("\n"))
      .setColor(0xFFD166);

    await interaction.reply({ embeds: [embed] });
  },
};
