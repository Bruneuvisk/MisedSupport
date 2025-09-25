import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { MetricsDao } from '../db/MetricsDao.js';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('Responde com Pong! e mostra a latência.').toJSON(),
  async execute({ client, interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    const count = await MetricsDao.incUserPing(interaction.user.id);
    const gatewayPing = Math.round(client.ws.ping);
    await interaction.reply({ content: `🏓 Pong! Latência ~${gatewayPing}ms | seu /ping nº ${count}`, ephemeral: true });
  }
};
