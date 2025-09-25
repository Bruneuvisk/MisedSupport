
import { Client, Events, Interaction, ChannelType, TextChannel, ButtonInteraction, ModalSubmitInteraction, StringSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } from 'discord.js';
import { WhitelistService, WL_IDS } from '../services/WhitelistService.js';
import { WhitelistConfigDao } from '../db/WhitelistConfigDao.js';
import { WhitelistSessionDao } from '../db/WhitelistSessionDao.js';

export default (client: Client) => {
  const svc = new WhitelistService(client);

  client.on(Events.InteractionCreate, async (i: Interaction) => {
    try {
      if (!i.inCachedGuild()) return;

      // START application
      if (i.isButton() && i.customId === WL_IDS.START) {
        await i.deferReply({ ephemeral: true });
        await svc.startForUser(i.guild!, i.user.id);
        const modal = svc.buildBasicsModal(i.guildId!, i.user.id);
        await i.editReply({ content: 'Vamos começar com seus dados básicos...' });
        return i.showModal(modal);
      }

      // SUBMIT basics
      if (i.isModalSubmit() && i.customId.startsWith(WL_IDS.SUBMIT_BASICS)) {
        const [, guildId, userId] = i.customId.split(':');
        if (guildId !== i.guildId || userId !== i.user.id) return i.reply({ content: 'Sessão inválida.', ephemeral: true });
        const name = i.fields.getTextInputValue('name').slice(0, 64);
        const ageStr = i.fields.getTextInputValue('age').slice(0, 3);
        const gameId = i.fields.getTextInputValue('gameId').slice(0, 64);
        const age = Math.max(0, parseInt(ageStr, 10) || 0);
        await WhitelistSessionDao.setBasics(i.guildId!, i.user.id, name, age, gameId);

        const cfg = await WhitelistConfigDao.get(i.guildId!);
        const questions = (cfg.questions?.length ? cfg.questions : (await import('../services/WhitelistService.js')).defaultQuestions?.(cfg.questionCount) ) ?? [];
        const sess = await WhitelistSessionDao.get(i.guildId!, i.user.id);
        const idx = sess?.step ?? 0;
        const embed = new (await import('discord.js')).EmbedBuilder()
          .setTitle(`Pergunta ${idx+1}/${questions.length}`)
          .setDescription(questions[idx] ?? 'Sem perguntas definidas.');
        const row = svc.questionRow(i.guildId!, i.user.id);
        return i.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // ANSWERS (buttons agree/neutral/disagree)
      if (i.isButton() && (i.customId.startsWith(WL_IDS.ANSWER_AGREE) || i.customId.startsWith(WL_IDS.ANSWER_NEUTRAL) || i.customId.startsWith(WL_IDS.ANSWER_DISAGREE))) {
        const [id, guildId, userId] = i.customId.split(':');
        if (guildId !== i.guildId || userId !== i.user.id) return i.reply({ content: 'Sessão inválida.', ephemeral: true });
        const cfg = await WhitelistConfigDao.get(i.guildId!);
        const questions = (cfg.questions?.length ? cfg.questions : (await import('../services/WhitelistService.js')).defaultQuestions?.(cfg.questionCount) ) ?? [];
        const answer = id.endsWith('agree') ? 'agree' : id.endsWith('neutral') ? 'neutral' : 'disagree';
        await WhitelistSessionDao.pushAnswer(i.guildId!, i.user.id, answer as any);
        const sess = await WhitelistSessionDao.get(i.guildId!, i.user.id);
        const idx = sess?.step ?? 0;
        if (idx >= questions.length) {
          if (cfg.requireBackstory) {
            const modal = svc.buildBackstoryModal(i.guildId!, i.user.id);
            await i.reply({ content: 'Agora conte a história do seu personagem.', ephemeral: true });
            return i.showModal(modal);
          } else {
            await svc.submitToStaff(i.guild!, i.user.id);
            return i.reply({ content: '✅ Sua whitelist foi enviada para análise da staff!', ephemeral: true });
          }
        } else {
          const embed = svc.questionEmbed(questions[idx], idx, questions.length);
          const row = svc.questionRow(i.guildId!, i.user.id);
          return i.update({ embeds: [embed], components: [row] });
        }
      }

      // SUBMIT backstory
      if (i.isModalSubmit() && i.customId.startsWith(WL_IDS.SUBMIT_BACKSTORY)) {
        const [, guildId, userId] = i.customId.split(':');
        if (guildId !== i.guildId || userId !== i.user.id) return i.reply({ content: 'Sessão inválida.', ephemeral: true });
        const story = i.fields.getTextInputValue('story');
        await WhitelistSessionDao.setBackstory(i.guildId!, i.user.id, story);
        await svc.submitToStaff(i.guild!, i.user.id);
        return i.reply({ content: '✅ Sua whitelist (com história) foi enviada para a staff!', ephemeral: true });
      }

      // STAFF: APPROVE / DENY
      if (i.isButton() && (i.customId.startsWith(WL_IDS.APPROVE) || i.customId.startsWith(WL_IDS.DENY))) {
        const [, guildId, userId] = i.customId.split(':');
        if (guildId !== i.guildId) return;
        await i.deferReply({ ephemeral: true });
        await svc.finalizeApproval(i.guild!, i.user.id, userId, i.customId.startsWith(WL_IDS.APPROVE) ? 'approved' : 'denied');
        return i.editReply({ content: 'Feito.' });
      }

      // CONFIG PANEL HANDLERS
      if (i.isButton()) {
        if (i.customId === WL_IDS.PANEL_SET_CHANNEL) {
          if (!i.channel || i.channel.type !== ChannelType.GuildText) return i.reply({ content: 'Execute no canal desejado para aplicação.', ephemeral: true });
          await WhitelistConfigDao.patch(i.guildId!, { applicationChannelId: i.channel.id });
          return i.reply({ content: `Canal de aplicação definido para ${i.channel}.`, ephemeral: true });
        }
        if (i.customId === WL_IDS.PANEL_SET_LOG_OK) {
          if (!i.channel || i.channel.type !== ChannelType.GuildText) return i.reply({ content: 'Execute no canal desejado.', ephemeral: true });
          await WhitelistConfigDao.patch(i.guildId!, { logsApprovedChannelId: i.channel.id });
          return i.reply({ content: `Canal de logs (aprovados) definido para ${i.channel}.`, ephemeral: true });
        }
        if (i.customId === WL_IDS.PANEL_SET_LOG_DENY) {
          if (!i.channel || i.channel.type !== ChannelType.GuildText) return i.reply({ content: 'Execute no canal desejado.', ephemeral: true });
          await WhitelistConfigDao.patch(i.guildId!, { logsDeniedChannelId: i.channel.id });
          return i.reply({ content: `Canal de logs (reprovados) definido para ${i.channel}.`, ephemeral: true });
        }
        if (i.customId === WL_IDS.PANEL_SET_LOG_STAFF) {
          if (!i.channel || i.channel.type !== ChannelType.GuildText) return i.reply({ content: 'Execute no canal desejado.', ephemeral: true });
          await WhitelistConfigDao.patch(i.guildId!, { logsStaffChannelId: i.channel.id });
          return i.reply({ content: `Canal de logs (staff) definido para ${i.channel}.`, ephemeral: true });
        }
        if (i.customId === WL_IDS.PANEL_SET_ROLE_WITH) {
          if (!i.memberPermissions?.has('ManageRoles')) return i.reply({ content: 'Sem permissão para configurar.', ephemeral: true });
          const modal = new ModalBuilder().setCustomId('wl:panel:role_with').setTitle('Setar Cargo COM WL')
            .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('role').setLabel('ID do cargo').setStyle(TextInputStyle.Short).setRequired(true)));
          return i.showModal(modal);
        }
        if (i.customId === WL_IDS.PANEL_SET_ROLE_WITHOUT) {
          if (!i.memberPermissions?.has('ManageRoles')) return i.reply({ content: 'Sem permissão.', ephemeral: true });
          const modal = new ModalBuilder().setCustomId('wl:panel:role_without').setTitle('Setar Cargo SEM WL')
            .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('role').setLabel('ID do cargo').setStyle(TextInputStyle.Short).setRequired(true)));
          return i.showModal(modal);
        }
        if (i.customId === WL_IDS.PANEL_TOGGLE_BACKSTORY) {
          const cfg = await WhitelistConfigDao.get(i.guildId!);
          await WhitelistConfigDao.patch(i.guildId!, { requireBackstory: !cfg.requireBackstory });
          return i.reply({ content: `Exigir história: ${!cfg.requireBackstory ? 'Sim' : 'Não'}.`, ephemeral: true });
        }
        if (i.customId === WL_IDS.PANEL_SET_QTD) {
          const sel = new StringSelectMenuBuilder()
            .setCustomId('wl:panel:qtd')
            .setPlaceholder('Escolha a quantidade de perguntas')
            .addOptions(
              { label: '3', value: '3' },
              { label: '10', value: '10' },
              { label: '15', value: '15' },
              { label: '20', value: '20' },
            );
          const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(sel);
          return i.reply({ content: 'Selecione a quantidade:', components: [row], ephemeral: true });
        }
        if (i.customId === WL_IDS.PANEL_SET_QUESTIONS) {
          const modal = new ModalBuilder().setCustomId('wl:panel:questions').setTitle('Definir Perguntas (1 por linha)')
            .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('qs').setLabel('Perguntas (até 20)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1900)));
          return i.showModal(modal);
        }
        if (i.customId === WL_IDS.PANEL_PUBLISH_START) {
          await i.deferReply({ ephemeral: true });
          const msg = await svc.publishStartMessage(i.guild!);
          return i.editReply({ content: `Publicado em ${msg.channel}.` });
        }
      }

      // select qtd
      if (i.isStringSelectMenu() && i.customId === 'wl:panel:qtd') {
        const v = Number(i.values[0] ?? '3') as 3|10|15|20;
        await WhitelistConfigDao.patch(i.guildId!, { questionCount: v });
        return i.update({ content: `Quantidade de perguntas: ${v}`, components: [] });
      }

      // modal cargos e perguntas
      if (i.isModalSubmit()) {
        if (i.customId === 'wl:panel:role_with') {
          const role = i.fields.getTextInputValue('role');
          await WhitelistConfigDao.patch(i.guildId!, { roleWithWL: role });
          return i.reply({ content: `Cargo COM WL atualizado: <@&${role}>`, ephemeral: true });
        }
        if (i.customId === 'wl:panel:role_without') {
          const role = i.fields.getTextInputValue('role');
          await WhitelistConfigDao.patch(i.guildId!, { roleWithoutWL: role });
          return i.reply({ content: `Cargo SEM WL atualizado: <@&${role}>`, ephemeral: true });
        }
        if (i.customId === 'wl:panel:questions') {
          const text = i.fields.getTextInputValue('qs');
          const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0,20);
          const cfg = await WhitelistConfigDao.get(i.guildId!);
          const count = cfg.questionCount ?? 3;
          const final = lines.slice(0, count);
          await WhitelistConfigDao.patch(i.guildId!, { questions: final });
          return i.reply({ content: `Definidas ${final.length} perguntas.`, ephemeral: true });
        }
      }

    } catch (e) {
      console.error('[whitelist] erro', e);
      if (i.isRepliable()) {
        try { await i.reply({ content: 'Ocorreu um erro.', ephemeral: true }); } catch {}
      }
    }
  });
};
