// src/commands/convert.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  Attachment,
} from 'discord.js';
import { ConvertioClient } from '../services/ConvertioClient.js';
import { ConvertJobDao } from '../db/ConvertJobDao.js';

function getAttachmentUrl(interaction: ChatInputCommandInteraction): string | null {
  const att = interaction.options.getAttachment('file') as Attachment | null;
  return att?.url ?? null;
}

export default {
  data: new SlashCommandBuilder()
    .setName('convert')
    .setDescription('Conversão de arquivos (estilo Convertio).')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    // /convert start
    .addSubcommand(sc =>
      sc
        .setName('start')
        .setDescription('Inicia uma conversão.')
        .addStringOption(o =>
          o
            .setName('outputformat')
            .setDescription('Formato de saída (ex.: png, mp3, pdf, docx...)')
            .setRequired(true)
        )
        .addAttachmentOption(o =>
          o.setName('file').setDescription('Anexe um arquivo para converter (opcional)')
        )
        .addStringOption(o =>
          o.setName('url').setDescription('Ou informe uma URL direta do arquivo (opcional)')
        )
        .addStringOption(o =>
          o.setName('ocr').setDescription('Habilitar OCR? (apenas para PDF/Imagem) yes/no')
        )
    )
    // /convert status
    .addSubcommand(sc =>
      sc
        .setName('status')
        .setDescription('Consulta o status de uma conversão.')
        .addStringOption(o =>
          o
            .setName('id')
            .setDescription('ID do job (se omitido, busca o mais recente seu nesta guild)')
            .setRequired(false)
        )
    )
    // /convert cancel
    .addSubcommand(sc =>
      sc
        .setName('cancel')
        .setDescription('Cancela uma conversão.')
        .addStringOption(o =>
          o.setName('id').setDescription('ID do job para cancelar').setRequired(true)
        )
    )
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.isChatInputCommand()) return;
    const sub = interaction.options.getSubcommand();

    // Evita timeout do Discord
    await interaction.deferReply({ ephemeral: false });

    const apiKey = process.env.CONVERTIO_API_KEY;
    if (!apiKey) {
      await interaction.editReply('❌ Variável `CONVERTIO_API_KEY` não definida no ambiente.');
      return;
    }
    const api = new ConvertioClient(apiKey);

    try {
      // ========= /convert start =========
      if (sub === 'start') {
        const outputformat = interaction.options
          .getString('outputformat', true)
          .toLowerCase()
          .trim();
        const ocr = (interaction.options.getString('ocr') || '').toLowerCase() === 'yes';

        // prioridade: anexo > url
        const attachUrl = getAttachmentUrl(interaction);
        const url = attachUrl ?? interaction.options.getString('url') ?? '';
        if (!url) {
          await interaction.editReply(
            '❌ Envie um **arquivo** em `file` ou uma **URL** válida em `url`.'
          );
          return;
        }

        // cria job remoto
        const { id: convertioId } = await api.startConversion({
          file: url,
          outputformat,
          options: ocr ? { ocr_enabled: true } : undefined,
          input: 'url',
        });

        // persiste no Mongo
        await ConvertJobDao.create({
          convertioId,
          userId: interaction.user.id,
          guildId: interaction.guildId!,
          input: url,
          outputFormat: outputformat,
          status: 'created',
        });

        // polling curto para tentar já entregar
        const result = await api.pollUntilFinished(convertioId, {
          timeoutMs: 30_000,
          intervalMs: 2_000,
        });

        if (!('ok' in result) || !result.ok) {
          await ConvertJobDao.updateStatus(convertioId, 'error');
          await interaction.editReply(
            `❌ **Falhou** (ID \`${convertioId}\`): ${('error' in result && result.error) || 'erro não informado'}`
          );
          return;
        }

        if (result.step === 'finish' && result.outputUrl) {
          const { buffer, filename } = await api.downloadResult(result.outputUrl, outputformat);
          await ConvertJobDao.updateStatus(convertioId, 'finished', result.outputUrl);
          await interaction.editReply({
            content: `✅ **Convertido!** ID: \`${convertioId}\` (${outputformat})`,
            files: [{ attachment: buffer, name: filename }],
          });
        } else {
          await ConvertJobDao.updateStatus(convertioId, 'converting', result.outputUrl);
          await interaction.editReply(
            `⏳ Conversão **iniciada** (ID: \`${convertioId}\`). Use \`/convert status id:${convertioId}\` para acompanhar.`
          );
        }
        return;
      }

      // ========= /convert status =========
      if (sub === 'status') {
        const idArg = interaction.options.getString('id');
        const job = idArg
          ? await ConvertJobDao.findById(idArg)
          : await ConvertJobDao.findMostRecentByUser(
              interaction.user.id,
              interaction.guildId!
            );

        if (!job) {
          await interaction.editReply(
            '❌ Não encontrei job. Informe `id:` ou inicie com `/convert start`.'
          );
          return;
        }

        const status = await api.getStatus(job.convertioId);

        if (!('ok' in status) || !status.ok) {
          await ConvertJobDao.updateStatus(job.convertioId, 'error');
          await interaction.editReply(
            `❌ **Falhou** (ID \`${job.convertioId}\`): ${('error' in status && status.error) || 'erro não informado'}`
          );
          return;
        }

        if (status.step === 'finish' && status.outputUrl) {
          const { buffer, filename } = await api.downloadResult(
            status.outputUrl,
            job.outputFormat
          );
          await ConvertJobDao.updateStatus(job.convertioId, 'finished', status.outputUrl);
          await interaction.editReply({
            content: `✅ **Pronto!** ID: \`${job.convertioId}\` (${job.outputFormat})`,
            files: [{ attachment: buffer, name: filename }],
          });
        } else {
          await ConvertJobDao.updateStatus(job.convertioId, 'converting', status.outputUrl);
          await interaction.editReply(
            `ℹ️ Status do job \`${job.convertioId}\`: **${status.step}** (${status.step_percent}%)`
          );
        }
        return;
      }

      // ========= /convert cancel =========
      if (sub === 'cancel') {
        const id = interaction.options.getString('id', true);
        const job = await ConvertJobDao.findById(id);
        if (!job) {
          await interaction.editReply('❌ ID não encontrado no histórico do bot.');
          return;
        }

        await api.cancel(job.convertioId);
        await ConvertJobDao.updateStatus(job.convertioId, 'canceled');
        await interaction.editReply(`🛑 Job \`${job.convertioId}\` **cancelado**.`);
        return;
      }
    } catch (err: any) {
      console.error('[convert] error:', err);
      await interaction.editReply(`❌ Ocorreu um erro: \`${err?.message ?? String(err)}\``);
    }
  },
};
