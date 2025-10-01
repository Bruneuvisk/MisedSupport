import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { InvitesDao } from "../db/InvitesDao.js";

export default {
  data: new SlashCommandBuilder()
    .setName("invitetop")
    .setDescription("Leaderboard de convites.")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addIntegerOption(o => o.setName("limite").setDescription("1–25").setMinValue(1).setMaxValue(25))
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.isChatInputCommand()) return;
    const guild = interaction.guild!;
    const limit = interaction.options.getInteger("limite") ?? 10;

    const top = await InvitesDao.top(guild.id, limit);
    if (!top.length) return interaction.reply("Ninguém tem convites ainda.");

    const lines = await Promise.all(top.map(async (row, i) => {
      const u = await interaction.client.users.fetch(row.userId).catch(() => null);
      const tag = u?.tag ?? row.userId;
      const total = (row.regular ?? 0) + (row.bonus ?? 0) - (row.leaves ?? 0) - (row.fake ?? 0);
      return `**${i + 1}.** \`${tag}\` — **${total}** (reg:${row.regular}|b:${row.bonus}|s:${row.leaves}|f:${row.fake})`;
    }));

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Invite Leaderboard (${limit})`)
      .setDescription(lines.join("\n"))
      .setColor(0xf1c40f);

    await interaction.reply({ embeds: [embed] });
  },
};
