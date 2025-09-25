import {
  SlashCommandBuilder, ChatInputCommandInteraction, Client,
  PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder
} from 'discord.js';

export const TICKET_IDS = {
  OPEN: 'ticket:open',
};

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Sistema de ticket no servidor.')
    .addSubcommand(s =>
      s.setName('painel')
        .setDescription('Publica o painel para abrir tickets.')
    )
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.inCachedGuild()) return;
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '❌ Requer **Gerenciar Servidor**.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎫 Suporte')
      .setDescription('Clique no botão abaixo para abrir um **ticket** com a equipe.');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(TICKET_IDS.OPEN).setLabel('Abrir Ticket').setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
