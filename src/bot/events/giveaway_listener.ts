import {
  Client,
  Events,
  ButtonInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { GW_IDS } from '../commands/giveaway.js';
import { GiveawayDao } from '../db/GiveawayDao.js';
import { GiveawayService } from '../services/GiveawayService.js';

export default (client: Client) => {
  const svc = new GiveawayService(client);

  client.on(Events.InteractionCreate, async (i) => {
    try {
      if (!i.inCachedGuild()) return;
      if (!i.isButton()) return;
      if (![GW_IDS.JOIN, GW_IDS.END].includes(i.customId)) return;

      const messageId = i.message?.id;
      if (!messageId) return;

      // JOIN
      if (i.customId === GW_IDS.JOIN) {
        await i.deferReply({ ephemeral: true });

        const g = await GiveawayDao.byMessage(messageId);
        if (!g || g.ended) {
          return i.editReply({ content: 'Este giveaway já foi encerrado.' });
        }

        // adiciona participante (set garante sem duplicar)
        await GiveawayDao.addEntrant(messageId, i.user.id);

        // feedback ao usuário
        await i.editReply({ content: '✅ Você entrou no sorteio!' }).catch(() => {});

        // atualiza contagem no embed da própria mensagem
        const fresh = await GiveawayDao.byMessage(messageId);
        const count = fresh?.entrants?.length ?? 0;

        const embed = new EmbedBuilder()
          .setTitle('🎉 Giveaway!')
          .setDescription(
            `Prêmio: **${fresh?.prize ?? '—'}**\n` +
            `Termina **<t:${fresh?.endsAt ?? 0}:R>**\n` +
            `Participantes: **${count}**\n\nClique em **Participar** abaixo para entrar.`
          );

        // edita a msg original (onde estão os botões)
        await i.message.edit({ embeds: [embed], components: i.message.components }).catch(() => {});
      }

      // END (apenas quem tem permissão de gerenciar servidor)
      if (i.customId === GW_IDS.END) {
        if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          return i.reply({ content: '❌ Você não tem permissão para encerrar.', ephemeral: true });
        }
        await i.deferReply({ ephemeral: true });

        const g = await GiveawayDao.byMessage(messageId);
        if (!g || g.ended) {
          return i.editReply({ content: 'Este giveaway já está encerrado.' });
        }

        await svc.finish(messageId);
        await i.editReply({ content: 'Giveaway encerrado!' }).catch(() => {});
      }
    } catch (e) {
      console.error('[giveaway] button error', e);
      if (i.isRepliable()) {
        try { await i.reply({ content: 'Ocorreu um erro.', ephemeral: true }); } catch {}
      }
    }
  });
};
