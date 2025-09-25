// src/bot/services/GiveawayService.ts
import { Client, EmbedBuilder } from 'discord.js';
import { GiveawayDao } from '../db/GiveawayDao.js';
import { toSendableChannel } from '../utils/sendable.js';

export class GiveawayService {
  constructor(private client: Client) {}

  async finish(messageId: string) {
    const g = await GiveawayDao.byMessage(messageId);
    if (!g || g.ended) return;

    const raw = await this.client.channels.fetch(g.channelId).catch(() => null);
    const channel = toSendableChannel(raw);
    if (!channel) return; // não é enviável

    await GiveawayDao.endNow(messageId);

    let winners: string[] = [];
    if (g.entrants?.length) {
      const shuffled = [...g.entrants].sort(() => Math.random() - 0.5);
      winners = shuffled.slice(0, Math.max(1, g.winners));
    }

    const embed = new EmbedBuilder()
      .setTitle('🎉 Giveaway encerrado!')
      .setDescription(
        `Prêmio: **${g.prize}**\n` +
        `Vencedor(es): ${winners.length ? winners.map(w => `<@${w}>`).join(', ') : 'ninguém :('}`
      );

    const mentions = winners.map(w => `<@${w}>`).join(' ');
    await channel.send({ content: mentions, embeds: [embed] }).catch(() => {});
  }
}
