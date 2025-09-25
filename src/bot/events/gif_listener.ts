import {
  ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, Client,
  EmbedBuilder, Events, GuildTextBasedChannel, Message, OverwriteType, PermissionFlagsBits
} from 'discord.js';
import { GIF_IDS } from '../commands/gif_painel.js';
import { GifSessionDao } from '../db/GifSessionDao.js';
import { GifService } from '../services/GifService.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

async function createPrivateChannelForUser(
  client: Client,
  guildId: string,
  baseChannel: GuildTextBasedChannel,
  userId: string,
  mode: 'convert'|'compress'
) {
  const guild = baseChannel.guild;
  const name = `gif-${mode}-${crypto.randomBytes(2).toString('hex')}`;

  const chan = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role },
      { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles], type: OverwriteType.Member },
      { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles], type: OverwriteType.Member },
    ],
    reason: `Sala de ${mode} para ${userId}`
  });

  await GifSessionDao.create(guild.id, chan.id, userId, mode);

  const info = mode === 'convert'
    ? 'Envie **um vídeo** (mp4/mov/webm). Eu converto e devolvo o **GIF**.'
    : 'Envie **um GIF**. Eu vou **comprimir** até ficar abaixo do alvo (padrão 8 MiB).';

  await (chan as any).send({
    content: `<@${userId}>`,
    embeds: [new EmbedBuilder().setTitle('Sala de GIF').setDescription(info).setFooter({ text: 'A sala será encerrada após o processamento.' })]
  });

  return chan;
}

export default (client: Client) => {

  // Clique no painel → cria sala
  client.on(Events.InteractionCreate, async (i) => {
    try {
      if (!i.inCachedGuild()) return;
      if (!i.isButton()) return;
      if (![GIF_IDS.PANEL_CONVERT, GIF_IDS.PANEL_COMPRESS].includes(i.customId)) return;

      const mode = i.customId === GIF_IDS.PANEL_CONVERT ? 'convert' : 'compress';
      if (!i.channel?.isTextBased()) return;
      await i.deferReply({ ephemeral: true });
      const chan = await createPrivateChannelForUser(client, i.guildId!, i.channel, i.user.id, mode);
      await i.editReply({ content: `Criei ${chan} para você enviar o arquivo.` });
    } catch (e) {
      console.error('[gif] panel click error', e);
      if (i.isRepliable()) await i.reply({ content: 'Erro ao criar sala.', ephemeral: true }).catch(()=>{});
    }
  });

  // Recebe arquivo na sala e processa
  client.on(Events.MessageCreate, async (msg: Message) => {
    if (!msg.inGuild() || !msg.channel || msg.author.bot) return;

    const session = await GifSessionDao.getByChannel(msg.channelId);
    if (!session) return; // não é sala de gif

    if (msg.author.id !== session.userId) {
      // Apenas o dono da sessão processa
      return;
    }

    const att = msg.attachments.first();
    if (!att) return; // espera um arquivo

    // baixa
    try {
      const url = att.url;
      const ext = path.extname(att.name ?? '').toLowerCase();
      const tmpIn = await GifService.downloadToTmp(url, `in${ext || ''}`);
      const tmpOut = path.join(path.dirname(tmpIn), 'out.gif');

      await msg.channel.send({ content: '⏳ Processando… isto pode levar alguns segundos.' });

      if (session.mode === 'convert') {
        // vídeo → gif
        await GifService.videoToGif(tmpIn, tmpOut, {
          fps: 12,
          scale: 320,
          maxBytes: 8 * 1024 * 1024, // opcional: já tenta deixar <= 8 MiB
        });
      } else {
        // compress gif
        // se usuário mandou não-gif por engano, tenta ffmpeg converter e depois comprimir
        if (!['.gif'].includes(ext)) {
          await GifService.videoToGif(tmpIn, tmpOut, { fps: 12, scale: 320 });
        } else {
          await GifService.compressGif(tmpIn, tmpOut, { targetBytes: 8 * 1024 * 1024 });
        }
      }

      const size = fs.statSync(tmpOut).size;
      const mb = (size / (1024*1024)).toFixed(2);
      await msg.channel.send({
        content: `✅ Pronto! Tamanho final: **${mb} MiB**`,
        files: [{ attachment: tmpOut, name: `resultado.gif` }]
      });

      await GifSessionDao.close(msg.channelId);
      await msg.channel.send('🧹 Encerrando a sala em 10s…');
      setTimeout(() => (msg.channel as any).delete().catch(()=>{}), 10_000);

    } catch (e: any) {
      console.error('[gif] process error', e);
      await msg.channel.send(`❌ Erro ao processar: \`${String(e?.message || e)}\``).catch(()=>{});
    }
  });

};
