
import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { AntispamConfigDao } from '../db/AntispamConfigDao.js';

export default {
  data: new SlashCommandBuilder()
    .setName('antispam')
    .setDescription('Configura o antispam básico.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(o => o.setName('enabled').setDescription('Ativar?').setRequired(true))
    .addIntegerOption(o => o.setName('msgs10s').setDescription('Mensagens permitidas a cada 10s').setMinValue(1).setRequired(true))
    .addIntegerOption(o => o.setName('timeout').setDescription('Timeout (s)').setMinValue(0).setRequired(true))
    .toJSON(),
  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.inCachedGuild()) return;
    const enabled = interaction.options.getBoolean('enabled', true);
    const msgs10 = interaction.options.getInteger('msgs10s', true);
    const timeout = interaction.options.getInteger('timeout', true);
    await AntispamConfigDao.set(interaction.guildId!, enabled, msgs10, timeout);
    await interaction.reply({ content: `Antispam ${enabled ? 'ativado' : 'desativado'} (${msgs10}/10s, timeout ${timeout}s)`, ephemeral: true });
  }
};
