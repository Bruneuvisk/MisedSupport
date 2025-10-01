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
    .setName("invites")
    .setDescription("Veja seus convites (ou de outro usuário).")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addUserOption(o => o.setName("user").setDescription("Usuário").setRequired(false))
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.isChatInputCommand()) return;
    const guild = interaction.guild!;
    const user = interaction.options.getUser("user") ?? interaction.user;

    const st = await InvitesDao.getStats(guild.id, user.id);
    const regular = st?.regular ?? 0;
    const bonus   = st?.bonus ?? 0;
    const leaves  = st?.leaves ?? 0;
    const fake    = st?.fake ?? 0;
    const total   = regular + bonus - leaves - fake;

    const embed = new EmbedBuilder()
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
      .setTitle("📨 Convites")
      .addFields(
        { name: "Regulares", value: String(regular), inline: true },
        { name: "Bônus", value: String(bonus), inline: true },
        { name: "Saídas", value: String(leaves), inline: true },
        { name: "Fakes", value: String(fake), inline: true },
        { name: "Total", value: `**${total}**`, inline: true },
      )
      .setColor(0x2ecc71);

    await interaction.reply({ embeds: [embed] });
  },
};
