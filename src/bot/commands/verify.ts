import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} from "discord.js";
import { VerifyDao, VerifyMethod } from "../db/VerifyDao.js";
import { genMathCaptcha, genToken } from "../utils/verifier.js";

export default {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Sistema de verificação (captcha/botão/passphrase/web).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // config
    .addSubcommand(sc => sc.setName("config")
      .setDescription("Configura o sistema de verificação.")
      .addBooleanOption(o => o.setName("enabled").setDescription("Ativar?"))
      .addChannelOption(o =>
        o
      .setName("canal")
      .setDescription("Canal com botão de verificar")
      .addChannelTypes(ChannelType.GuildText)
      ).addRoleOption(o => o.setName("cargo_verificado").setDescription("Cargo de verificado"))
      .addRoleOption(o => o.setName("cargo_nao_verificado").setDescription("Cargo atribuído ao entrar (opcional)"))
      .addStringOption(o => o.setName("metodos").setDescription("Lista separada por vírgula (captcha,button,passphrase,web)"))
      .addStringOption(o => o.setName("passphrase").setDescription("Frase secreta (se habilitar passphrase)"))
      .addIntegerOption(o => o.setName("timeout").setDescription("Tempo máx em segundos (padrão 600)").setMinValue(30))
      .addIntegerOption(o => o.setName("tentativas").setDescription("Máx de tentativas (padrão 3)").setMinValue(1))
      .addStringOption(o => o.setName("dm_template").setDescription("Mensagem DM para novos membros"))
    )

    // start (para usuário rodar manualmente; não exige ManageGuild)
    .addSubcommand(sc => sc.setName("start")
      .setDescription("Inicia sua verificação (usuário).")
    )

    // web (usuário informa o token recebido por um site seu, por exemplo)
    .addSubcommand(sc => sc.setName("web")
      .setDescription("Confirma verificação via token.")
      .addStringOption(o => o.setName("token").setDescription("Token gerado no site").setRequired(true))
    )
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.isChatInputCommand()) return;
    const sub = interaction.options.getSubcommand();

    // ===== /verify config =====
    if (sub === "config") {
      const guild = interaction.guild!;
      await interaction.deferReply({ ephemeral: true });

      const enabled = interaction.options.getBoolean("enabled") ?? undefined;
      const ch = interaction.options.getChannel("canal");
      const vrole = interaction.options.getRole("cargo_verificado");
      const urole = interaction.options.getRole("cargo_nao_verificado");
      const methodsStr = interaction.options.getString("metodos") ?? undefined;
      const passphrase = interaction.options.getString("passphrase") ?? undefined;
      const timeout = interaction.options.getInteger("timeout") ?? undefined;
      const attempts = interaction.options.getInteger("tentativas") ?? undefined;
      const dmTemplate = interaction.options.getString("dm_template") ?? undefined;

      const methods = methodsStr
        ? methodsStr.split(",").map(s => s.trim().toLowerCase() as VerifyMethod).filter(Boolean)
        : undefined;

      const cfg = await VerifyDao.setCfg(guild.id, {
        enabled,
        channelId: ch?.id,
        verifiedRoleId: vrole?.id,
        unverifiedRoleId: urole?.id,
        methods: methods as any,
        passphrase,
        timeoutSec: timeout,
        maxAttempts: attempts,
        dmTemplate,
      });

      await interaction.editReply(`✅ Config atualizada.\nAtivo: ${cfg?.enabled}\nCanal: ${cfg?.channelId ? `<#${cfg.channelId}>` : "—"}\nMétodos: ${(cfg?.methods ?? []).join(", ")}`);
      return;
    }

    // ===== /verify start =====
    if (sub === "start") {
      const guild = interaction.guild!;
      const cfg = await VerifyDao.getCfg(guild.id);
      if (!cfg.enabled) { await interaction.reply({ content: "❌ Verificação desativada.", ephemeral: true }); return; }

      // mostra UI com botões para escolher método
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...cfg.methods.map(m => new ButtonBuilder()
          .setCustomId(`vf:${m}`)
          .setStyle(m === "button" ? ButtonStyle.Success : ButtonStyle.Primary)
          .setLabel(m.toUpperCase()))
      );
      await interaction.reply({ content: "Selecione um método de verificação:", components: [row], ephemeral: true });
      return;
    }

    // ===== /verify web =====
    if (sub === "web") {
      const guild = interaction.guild!;
      const token = interaction.options.getString("token", true).trim();
      const ses = await VerifyDao.getSession(guild.id, interaction.user.id);
      if (!ses || ses.token !== token || (ses.expiresAt < Date.now())) {
        await interaction.reply({ content: "❌ Token inválido ou expirado.", ephemeral: true });
        return;
      }
      await completeVerification(interaction.client, guild.id, interaction.user.id, "web");
      await interaction.reply({ content: "✅ Verificação concluída via web.", ephemeral: true });
      return;
    }
  },
};

// ===== helpers compartilhados pelo listener também =====
export async function startMethodFlow(client: Client, guildId: string, userId: string, method: VerifyMethod) {
  const guild = await client.guilds.fetch(guildId);
  const cfg = await VerifyDao.getCfg(guildId);
  const member = await guild.members.fetch(userId);

  const expiresAt = Date.now() + (cfg.timeoutSec * 1000);

  if (method === "button") {
    // basta aguardar o clique (listener marca como concluído). Aqui só DM orientação.
    await VerifyDao.upsertSession(guildId, userId, { method, attempts: 0, expiresAt, expectedAnswer: null });
    await member.send?.("Clique no botão **Verificar** que aparecerá para você no servidor.").catch(() => {});
    return;
  }

  if (method === "captcha") {
    const { expr, answer } = genMathCaptcha();
    await VerifyDao.upsertSession(guildId, userId, { method, expectedAnswer: answer, attempts: 0, expiresAt });
    // abre modal
    const modal = new ModalBuilder()
      .setCustomId(`vf:captcha:${guildId}`)
      .setTitle("Verificação — Captcha");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("captcha")
          .setLabel(`Resolva: ${expr}`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    // precisa ser aberta a partir de uma interação; o listener faz isso quando o usuário clica no botão.
    return modal; // se for chamado de um handler de botão, você usa interaction.showModal(modal)
  }

  if (method === "passphrase") {
    if (!cfg.passphrase) throw new Error("Passphrase não configurada.");
    await VerifyDao.upsertSession(guildId, userId, { method, expectedAnswer: cfg.passphrase, attempts: 0, expiresAt });
    const modal = new ModalBuilder()
      .setCustomId(`vf:pass:${guildId}`)
      .setTitle("Verificação — Passphrase");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("phrase")
          .setLabel("Digite a passphrase")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return modal;
  }

  if (method === "web") {
    const token = genToken(32);
    await VerifyDao.upsertSession(guildId, userId, { method, token, attempts: 0, expiresAt });
    await member.send?.(`Use este token no site para validar: \`${token}\`\nDepois rode **/verify web token:${token}**.`).catch(() => {});
    return;
  }
}

export async function completeVerification(client: Client, guildId: string, userId: string, method: VerifyMethod) {
  const guild = await client.guilds.fetch(guildId);
  const member = await guild.members.fetch(userId);
  const cfg = await VerifyDao.getCfg(guildId);

  // roles
  if (cfg.verifiedRoleId) {
    const role = guild.roles.cache.get(cfg.verifiedRoleId) ?? await guild.roles.fetch(cfg.verifiedRoleId).catch(() => null);
    if (role) await member.roles.add(role, `Verifier: ${method}`);
  }
  if (cfg.unverifiedRoleId) {
    const r = guild.roles.cache.get(cfg.unverifiedRoleId) ?? await guild.roles.fetch(cfg.unverifiedRoleId).catch(() => null);
    if (r) await member.roles.remove(r, "Verifier concluído");
  }

  await VerifyDao.setSession(guildId, userId, { verifiedAt: Date.now(), expectedAnswer: null, token: null });
}
