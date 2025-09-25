import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { WhitelistService } from '../services/WhitelistService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Sistema de whitelist para FiveM.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('config').setDescription('Abrir painel de configuração'))
    .addSubcommand(s => s.setName('iniciar').setDescription('Publicar o botão de início no canal configurado'))
    .toJSON(),

  async execute({ client, interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.inCachedGuild()) return;
    const svc = new WhitelistService(client);
    const sub = interaction.options.getSubcommand();
    if (sub === 'config') {
      await svc.openConfigPanel(interaction);
    } else if (sub === 'iniciar') {
      await interaction.deferReply({ ephemeral: true });
      const msg = await svc.publishStartMessage(interaction.guild!);
      await interaction.editReply({ content: `Mensagem publicada em ${msg.channel}` });
    }
  }
};
