import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

export const GIF_IDS = {
  PANEL_CONVERT: 'gif:panel:convert',
  PANEL_COMPRESS: 'gif:panel:compress',
};

export default {
  data: new SlashCommandBuilder()
    .setName('gif')
    .setDescription('Ferramentas de GIF (converter/comprimir).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('painel').setDescription('Publica os botões de conversão e compressão no canal atual.'))
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.inCachedGuild() || !interaction.channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('🎞️ GIF Tools')
      .setDescription('Escolha uma opção:\n- **Converter**: envie um **vídeo** e receba um **GIF**.\n- **Comprimir**: envie um **GIF** e receba ele **otimizado** (alvo padrão 8 MiB).');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(GIF_IDS.PANEL_CONVERT).setLabel('Converter Vídeo → GIF').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(GIF_IDS.PANEL_COMPRESS).setLabel('Comprimir GIF').setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
