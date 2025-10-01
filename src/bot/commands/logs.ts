import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
} from "discord.js";
import { LogConfigDao } from "../db/LogConfigDao.js";

export default {
  data: new SlashCommandBuilder()
    .setName("logs")
    .setDescription("Configura os logs do servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sc =>
      sc
        .setName("set")
        .setDescription("Define o canal de logs")
        .addChannelOption(o =>
          o.setName("canal").setDescription("Canal para logs").setRequired(true)
        )
    )
    .addSubcommand(sc =>
      sc.setName("disable").setDescription("Desativa o sistema de logs")
    )
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.isChatInputCommand()) return;
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild!;
    await interaction.deferReply({ ephemeral: true });

    if (sub === "set") {
      const channel = interaction.options.getChannel("canal", true);
      await LogConfigDao.set(guild.id, channel.id, true);
      await interaction.editReply(`✅ Logs ativados no canal ${channel}`);
    }

    if (sub === "disable") {
      await LogConfigDao.disable(guild.id);
      await interaction.editReply(`🛑 Logs desativados neste servidor.`);
    }
  },
};
