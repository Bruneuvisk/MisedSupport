
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ChatInputCommandInteraction, Client, EmbedBuilder, Guild, GuildMember, Interaction, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { WhitelistConfigDao } from '../db/WhitelistConfigDao.js';
import { WhitelistSessionDao } from '../db/WhitelistSessionDao.js';
import { WhitelistMySQLDao } from '../db/WhitelistMySQLDao.js';

const CUSTOM_ID = {
  PANEL_SET_CHANNEL: 'wl:panel:set_channel',
  PANEL_SET_LOG_OK: 'wl:panel:set_log_ok',
  PANEL_SET_LOG_DENY: 'wl:panel:set_log_deny',
  PANEL_SET_LOG_STAFF: 'wl:panel:set_log_staff',
  PANEL_SET_ROLE_WITH: 'wl:panel:set_role_with',
  PANEL_SET_ROLE_WITHOUT: 'wl:panel:set_role_without',
  PANEL_TOGGLE_BACKSTORY: 'wl:panel:toggle_backstory',
  PANEL_SET_QTD: 'wl:panel:set_qtd',
  PANEL_SET_QUESTIONS: 'wl:panel:set_questions',
  PANEL_PUBLISH_START: 'wl:panel:publish_start',

  START: 'wl:start',
  ANSWER_AGREE: 'wl:ans:agree',
  ANSWER_NEUTRAL: 'wl:ans:neutral',
  ANSWER_DISAGREE: 'wl:ans:disagree',

  APPROVE: 'wl:approve',
  DENY: 'wl:deny',
  ASK_BASICS: 'wl:ask_basics',
  SUBMIT_BASICS: 'wl:submit_basics',
  ASK_BACKSTORY: 'wl:ask_backstory',
  SUBMIT_BACKSTORY: 'wl:submit_backstory',
};

export function defaultQuestions(n: number): string[] {
  const pool = [
    'Você entende as regras básicas do servidor e concorda em segui-las?',
    'Você sabe que RDM/VDM não são permitidos?',
    'Você concorda em manter bom senso e respeito nas interações?',
    'Você compreende que falhas propositalmente exploradas são passíveis de banimento?',
    'Você sabe que metagaming/powergaming são proibidos?',
    'Você aceita seguir as orientações da staff quando solicitado?',
    'Você se compromete a não usar cheats/macros?',
    'Você concorda em manter o roleplay acima de objetivos pessoais?',
    'Você compreende que report deve ser feito nos canais corretos?',
    'Você está ciente das punições por desrespeito a regras?',
    'Você entende as diretrizes de voz e comunicação no RP?',
    'Você se compromete a evitar ofensas e discurso de ódio?',
    'Você sabe que ameaças fora do jogo resultam em banimento imediato?',
    'Você concorda com verificação de logs/dados em caso de denúncia?',
    'Você entende que regras podem ser atualizadas e deve se manter informado?',
    'Você está ciente das limitações de cop/ems RP?',
    'Você compreende regras de roubos e sequestros?',
    'Você entende o uso correto de safezone?',
    'Você aceita que o staff tem decisão final em conflitos?',
    'Você se compromete a não divulgar exploits publicamente?'
  ];
  return pool.slice(0, n);
}

export class WhitelistService {
  constructor(private client: Client) {}

  // CONFIG PANEL
  async openConfigPanel(interaction: ChatInputCommandInteraction) {
    const cfg = await WhitelistConfigDao.get(interaction.guildId!);
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Painel de Configuração — Whitelist')
      .setDescription('Defina os canais, cargos e parâmetros.')
      .addFields(
        { name: 'Canal de aplicação', value: cfg.applicationChannelId ? `<#${cfg.applicationChannelId}>` : '—', inline: true },
        { name: 'Logs Aprovados', value: cfg.logsApprovedChannelId ? `<#${cfg.logsApprovedChannelId}>` : '—', inline: true },
        { name: 'Logs Reprovados', value: cfg.logsDeniedChannelId ? `<#${cfg.logsDeniedChannelId}>` : '—', inline: true },
        { name: 'Logs Staff', value: cfg.logsStaffChannelId ? `<#${cfg.logsStaffChannelId}>` : '—', inline: true },
        { name: 'Cargo COM WL', value: cfg.roleWithWL ? `<@&${cfg.roleWithWL}>` : '—', inline: true },
        { name: 'Cargo SEM WL', value: cfg.roleWithoutWL ? `<@&${cfg.roleWithoutWL}>` : '—', inline: true },
        { name: 'Exigir história?', value: cfg.requireBackstory ? 'Sim' : 'Não', inline: true },
        { name: 'Nº Perguntas', value: String(cfg.questionCount), inline: true },
        { name: 'Perguntas', value: cfg.questions?.length ? cfg.questions.map((q,i)=>`**${i+1}.** ${q}`).join('\n').slice(0,1024) : '_Usando perguntas padrão._' }
      );

    const row1 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId(CUSTOM_ID.PANEL_SET_CHANNEL).setLabel('Definir Canal').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(CUSTOM_ID.PANEL_SET_LOG_OK).setLabel('Log Aprovados').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(CUSTOM_ID.PANEL_SET_LOG_DENY).setLabel('Log Reprovados').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(CUSTOM_ID.PANEL_SET_LOG_STAFF).setLabel('Log Staff').setStyle(ButtonStyle.Secondary),
      );
    const row2 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId(CUSTOM_ID.PANEL_SET_ROLE_WITH).setLabel('Cargo COM WL').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(CUSTOM_ID.PANEL_SET_ROLE_WITHOUT).setLabel('Cargo SEM WL').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(CUSTOM_ID.PANEL_TOGGLE_BACKSTORY).setLabel('Alternar História').setStyle(ButtonStyle.Secondary),
      );
    const row3 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId(CUSTOM_ID.PANEL_SET_QTD).setLabel('Nº Perguntas (3/10/15/20)').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(CUSTOM_ID.PANEL_SET_QUESTIONS).setLabel('Definir Perguntas').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(CUSTOM_ID.PANEL_PUBLISH_START).setLabel('Publicar Botão de Início').setStyle(ButtonStyle.Success),
      );

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ embeds: [embed], components: [row1, row2, row3] });
    } else {
      const msg = await interaction.reply({ embeds: [embed], components: [row1, row2, row3], ephemeral: true, fetchReply: true });
      await WhitelistConfigDao.patch(interaction.guildId!, { panelMessageId: msg.id });
    }
  }

  async publishStartMessage(guild: Guild) {
    const cfg = await WhitelistConfigDao.get(guild.id);
    if (!cfg.applicationChannelId) throw new Error('Defina o canal de aplicação primeiro.');
    const ch = await guild.channels.fetch(cfg.applicationChannelId).catch(()=>null);
    if (!ch || ch.type !== ChannelType.GuildText) throw new Error('Canal inválido.');
    const embed = new EmbedBuilder().setTitle('📝 Whitelist').setDescription('Clique no botão para iniciar sua whitelist.');
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(new ButtonBuilder().setCustomId(CUSTOM_ID.START).setStyle(ButtonStyle.Primary).setLabel('Iniciar Whitelist'));
    const msg = await ch.send({ embeds: [embed], components: [row] });
    await WhitelistConfigDao.patch(guild.id, { startMessageId: msg.id, enabled: true });
    return msg;
  }

  // APPLICATION FLOW
  async startForUser(guild: Guild, userId: string) {
    await WhitelistSessionDao.start(guild.id, userId);
  }

  buildBasicsModal(guildId: string, userId: string) {
    return new ModalBuilder()
      .setCustomId(`${CUSTOM_ID.SUBMIT_BASICS}:${guildId}:${userId}`)
      .setTitle('Dados Básicos')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Nome').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('age').setLabel('Idade').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('gameId').setLabel('ID no Jogo').setStyle(TextInputStyle.Short).setRequired(true)),
      );
  }

  buildBackstoryModal(guildId: string, userId: string) {
    return new ModalBuilder()
      .setCustomId(`${CUSTOM_ID.SUBMIT_BACKSTORY}:${guildId}:${userId}`)
      .setTitle('História do Personagem')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('story').setLabel('Conte a história').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)),
      );
  }

  questionEmbed(prompt: string, index: number, total: number) {
    return new EmbedBuilder()
      .setTitle(`Pergunta ${index+1}/${total}`)
      .setDescription(prompt)
      .setFooter({ text: 'Responda usando os botões abaixo.' });
  }

  questionRow(guildId: string, userId: string) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${CUSTOM_ID.ANSWER_AGREE}:${guildId}:${userId}`).setLabel('Concordo').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${CUSTOM_ID.ANSWER_NEUTRAL}:${guildId}:${userId}`).setLabel('Neutro').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${CUSTOM_ID.ANSWER_DISAGREE}:${guildId}:${userId}`).setLabel('Discordo').setStyle(ButtonStyle.Danger),
    );
  }

  async submitToStaff(guild: Guild, userId: string) {
    const cfg = await WhitelistConfigDao.get(guild.id);
    const sess = await WhitelistSessionDao.get(guild.id, userId);
    if (!cfg.logsStaffChannelId || !sess) return;
    const ch = await guild.channels.fetch(cfg.logsStaffChannelId).catch(()=>null);
    if (!ch?.isTextBased()) return;
    const fields = [
      { name: 'Nome', value: sess.name ?? '—', inline: true },
      { name: 'Idade', value: String(sess.age ?? '—'), inline: true },
      { name: 'ID Jogo', value: sess.gameId ?? '—', inline: true },
      { name: 'Respostas', value: sess.answers.map((a,i)=>`**${i+1}.** ${a}`).join('\n') || '—' },
    ];
    if (cfg.requireBackstory) fields.push({ name: 'História', value: sess.backstory ?? '—' });
    const embed = new EmbedBuilder().setTitle('📨 Nova Whitelist').setDescription(`<@${userId}> enviou a whitelist.`).addFields(fields);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${CUSTOM_ID.APPROVE}:${guild.id}:${userId}`).setLabel('Aprovar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${CUSTOM_ID.DENY}:${guild.id}:${userId}`).setLabel('Reprovar').setStyle(ButtonStyle.Danger),
    );
    await ch.send({ embeds: [embed], components: [row] });
    await WhitelistSessionDao.close(guild.id, userId);
  }

  async finalizeApproval(guild: Guild, staffId: string, userId: string, status: 'approved'|'denied') {
    const cfg = await WhitelistConfigDao.get(guild.id);
    const member = await guild.members.fetch(userId).catch(()=>null);
    if (status === 'approved') {
      if (cfg.roleWithWL && member?.manageable) await member.roles.add(cfg.roleWithWL).catch(()=>{});
      if (cfg.roleWithoutWL && member?.manageable) await member.roles.remove(cfg.roleWithoutWL).catch(()=>{});
      if (cfg.logsApprovedChannelId) {
        const ch = await guild.channels.fetch(cfg.logsApprovedChannelId).catch(()=>null);
        if (ch?.isTextBased()) await ch.send(`✅ <@${userId}> aprovado por <@${staffId}>.`);
      }
      await WhitelistMySQLDao.setStatus(userId, 'approved', staffId);
    } else {
      if (cfg.logsDeniedChannelId) {
        const ch = await guild.channels.fetch(cfg.logsDeniedChannelId).catch(()=>null);
        if (ch?.isTextBased()) await ch.send(`❌ <@${userId}> reprovado por <@${staffId}>.`);
      }
      await WhitelistMySQLDao.setStatus(userId, 'denied', staffId);
    }
  }
}

export const WL_IDS = CUSTOM_ID;