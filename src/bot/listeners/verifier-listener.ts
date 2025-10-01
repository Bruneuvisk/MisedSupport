import {
  Client,
  Events,
  GuildMember,
  PartialGuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalSubmitInteraction,
  ButtonInteraction,
  EmbedBuilder,
} from "discord.js";
import { VerifyDao } from "../db/VerifyDao.js";
import { startMethodFlow, completeVerification } from "../commands/verify.js";

function isGuildText(ch: any): ch is import("discord.js").GuildTextBasedChannel {
  return !!ch && typeof ch.isTextBased === "function" && ch.isTextBased() && !ch.isDMBased?.();
}

export function registerVerifier(client: Client) {
  // Quando alguém entra
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    try {
      const cfg = await VerifyDao.getCfg(member.guild.id);
      if (!cfg.enabled) return;

      // aplica cargo de "não verificado" se configurado
      if (cfg.unverifiedRoleId) {
        const r = member.guild.roles.cache.get(cfg.unverifiedRoleId) ?? await member.guild.roles.fetch(cfg.unverifiedRoleId).catch(() => null);
        if (r) await member.roles.add(r, "Aguardando verificação");
      }

      // manda DM de orientação
      const text = cfg.dmTemplate ?? `Bem-vindo(a)! Para acessar o servidor, clique em **Verificar** no canal configurado ou use **/verify start**.`;
      await member.send?.(text).catch(() => {});

      // posta no canal de verificação (se houver)
      if (cfg.channelId) {
        const ch = member.guild.channels.cache.get(cfg.channelId) ?? await member.guild.channels.fetch(cfg.channelId).catch(() => null);
        if (isGuildText(ch)) {
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`vf:choose`).setLabel("Verificar").setStyle(ButtonStyle.Primary)
          );
          const emb = new EmbedBuilder()
            .setTitle("Verificação necessária")
            .setDescription(`Clique em **Verificar** para escolher um método (${cfg.methods.join(", ")}).`)
            .setColor(0x5865F2);
          await ch.send({ content: `${member}`, embeds: [emb], components: [row] });
        }
      }
    } catch (e) {
      console.error("[verifier] on join:", e);
    }
  });

  // Clique no botão "Verificar" ou escolha de método
  client.on(Events.InteractionCreate, async (itx) => {
    if (itx.isButton()) {
      const bi = itx as ButtonInteraction;
      const [tag, methodRaw, gid] = bi.customId.split(":"); // ex: vf:captcha:<guildId>
      if (tag !== "vf") {
        if (bi.customId === "vf:choose") {
          // mostra seleção rápida (mesmo de /verify start)
          const cfg = await VerifyDao.getCfg(bi.guild!.id);
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            ...cfg.methods.map(m => new ButtonBuilder().setCustomId(`vf:${m}:${bi.guild!.id}`).setLabel(m.toUpperCase()).setStyle(m === "button" ? ButtonStyle.Success : ButtonStyle.Primary))
          );
          await bi.reply({ content: "Escolha seu método:", components: [row], ephemeral: true });
          return;
        }
        return;
      }
      const method = methodRaw as any;
      const guildId = gid ?? bi.guild!.id;
      const userId = bi.user.id;

      // se método = button, concluímos direto
      if (method === "button") {
        await VerifyDao.upsertSession(guildId, userId, {
          method: "button",
          attempts: 0,
          expiresAt: Date.now() + (await VerifyDao.getCfg(guildId)).timeoutSec * 1000,
        });
        await completeVerification(bi.client, guildId, userId, "button");
        await bi.reply({ content: "✅ Verificação concluída (botão).", ephemeral: true });
        return;
      }

      // outros métodos abrem modal
      const modal = await startMethodFlow(bi.client, guildId, userId, method);
      if (modal) {
        await bi.showModal(modal);
      } else {
        await bi.reply({ content: "Algo deu errado ao iniciar o método.", ephemeral: true });
      }
      return;
    }

    // Submissão de modal (captcha/passphrase)
    if (itx.isModalSubmit()) {
      const mi = itx as ModalSubmitInteraction;
      const [tag, kind, guildId] = mi.customId.split(":"); // vf:captcha:<guildId> ou vf:pass:<guildId>
      if (tag !== "vf") return;
      const userId = mi.user.id;
      const cfg = await VerifyDao.getCfg(guildId);
      const ses = await VerifyDao.getSession(guildId, userId);
      if (!ses || ses.expiresAt < Date.now()) {
        await mi.reply({ content: "⏳ Sessão expirada. Use /verify start novamente.", ephemeral: true });
        return;
      }

      const fieldId = kind === "captcha" ? "captcha" : "phrase";
      const val = mi.fields.getTextInputValue(fieldId).trim();

      const attempts = (ses.attempts ?? 0) + 1;
      const stillAttempts = attempts < (cfg.maxAttempts);
      const ok = (val === (ses.expectedAnswer ?? ""));

      if (!ok) {
        await VerifyDao.setSession(guildId, userId, { attempts });
        await mi.reply({ content: stillAttempts ? `❌ Resposta incorreta. Tentativas restantes: ${cfg.maxAttempts - attempts}` : "❌ Limite de tentativas atingido." , ephemeral: true });
        return;
      }

      await completeVerification(mi.client, guildId, userId, kind === "captcha" ? "captcha" : "passphrase");
      await mi.reply({ content: "✅ Verificação concluída.", ephemeral: true });
      return;
    }
  });
}
