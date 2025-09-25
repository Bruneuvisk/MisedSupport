
import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { AutoroleConfigDao } from '../db/AutoroleConfigDao.js';

export default {
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Configura o autorole ao entrar no servidor.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(o => o.setName('enabled').setDescription('Ativar?').setRequired(true))
    .addStringOption(o => o.setName('roles').setDescription('IDs das roles separados por vírgula').setRequired(true))
    .toJSON(),
  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.inCachedGuild()) return;
    const enabled = interaction.options.getBoolean('enabled', true);
    const rolesStr = interaction.options.getString('roles', true);
    const roleIds = rolesStr.split(',').map(s => s.trim()).filter(Boolean);
    await AutoroleConfigDao.set(interaction.guildId!, enabled, roleIds);
    await interaction.reply({ content: `Autorole ${enabled ? 'ativado' : 'desativado'} para ${roleIds.length} cargo(s).`, ephemeral: true });
  }
};
