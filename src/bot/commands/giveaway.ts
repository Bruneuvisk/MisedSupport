import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { GiveawayDao } from '../db/GiveawayDao.js';

function parseDuration(s: string): number {
  // "10m", "2h", "1d"
  const m = /^([0-9]+)\s*([smhd])$/i.exec(s.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  return u === 's' ? n : u === 'm' ? n * 60 : u === 'h' ? n * 3600 : n * 86400;
}

// IDs estáticos — o listener usa interaction.customId e interaction.message.id
export const GW_IDS = {
  JOIN: 'gw:join',
  END: 'gw:end',
};

export default {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Cria um sorteio simples no canal atual.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName('premio').setDescription('Prêmio do sorteio').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('duracao').setDescription('Ex.: 10m, 2h, 1d').setRequired(true)
    )
    .addIntegerOption(o =>
      o
        .setName('vencedores')
        .setDescription('Quantidade de vencedores')
        .setMinValue(1)
        .setRequired(false)
    )
    .toJSON(),

  async execute({ client, interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.inCachedGuild() || !interaction.channel) return;

    const prize = interaction.options.getString('premio', true);
    const dur = parseDuration(interaction.options.getString('duracao', true));
    const winners = interaction.options.getInteger('vencedores') ?? 1;

    if (!dur) {
      return interaction.reply({
        content: 'Duração inválida. Use s/m/h/d (ex.: **10m**, **2h**, **1d**).',
        ephemeral: true,
      });
    }

    const endsAt = Math.floor(Date.now() / 1000) + dur;

    // Cria doc no Mongo (ainda sem messageId)
    const doc = await GiveawayDao.create({
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      prize,
      winners,
      endsAt,
      entrants: [],
    } as any);

    const embed = new EmbedBuilder()
      .setTitle('🎉 Giveaway!')
      .setDescription(
        `Prêmio: **${prize}**\nTermina **<t:${endsAt}:R>**\n` +
        `Participantes: **0**\n\nClique em **Participar** abaixo para entrar.`
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(GW_IDS.JOIN).setLabel('Participar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(GW_IDS.END).setLabel('Encerrar').setStyle(ButtonStyle.Danger),
    );

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
    await GiveawayDao.setMessageId(doc.insertedId, msg.id);

    await interaction.reply({ content: 'Giveaway iniciado!', ephemeral: true });
  },
};
