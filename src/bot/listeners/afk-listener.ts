import {
  Client,
  Message,
  Events,
  GuildMember,
} from "discord.js";
import { AfkDao } from "../db/AfkDao.js";

// quando alguém mencionou usuários, avisar se estão AFK
async function handleMentions(msg: Message) {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.mentions.users.size) return;

  const mentionedIds = [...msg.mentions.users.keys()].filter(id => id !== msg.author.id);
  if (!mentionedIds.length) return;

  const afks = await AfkDao.getManyAfk(msg.guild.id, mentionedIds);
  if (!afks.length) return;

  const lines = afks.map(a => {
    const user = msg.client.users.cache.get(a.userId);
    const tag = user ? `**@${user.tag}**` : `<@${a.userId}>`;
    const sinceMs = Date.now() - a.since.getTime();
    const dur = Math.max(1, Math.floor(sinceMs / 1000));
    const pretty =
      dur >= 3600 ? `${Math.floor(dur / 3600)}h` :
      dur >= 60   ? `${Math.floor(dur / 60)}m`  :
                    `${dur}s`;
    return `${tag} está **AFK** há ${pretty}${a.reason ? ` — Motivo: _${a.reason}_` : ""}.`;
  });

  // responde leve (sem ping extra)
  await msg.reply({ allowedMentions: { repliedUser: false }, content: lines.join("\n") });
}

// quando o autor AFK falar, desligar AFK automaticamente
async function handleSelfMessage(msg: Message) {
  if (!msg.guild || msg.author.bot) return;

  const afk = await AfkDao.getAfk(msg.guild.id, msg.author.id);
  if (!afk) return;

  // desliga
  const removed = await AfkDao.clearAfk(msg.guild.id, msg.author.id);

  // tenta restaurar nick
  try {
    const member = await msg.guild.members.fetch(msg.author.id);
    if (member.manageable && member.displayName.startsWith("[AFK] ")) {
      const target = removed?.oldNick ?? null;
      await member.setNickname(target, "AFK auto-desligado ao falar");
    }
  } catch {
    // ignore
  }

  await msg.reply({
    allowedMentions: { repliedUser: false },
    content: "👋 Você voltou! **AFK desligado.**",
  });
}

export function registerAfkListener(client: Client) {
  client.on(Events.MessageCreate, async (msg) => {
    try {
      await handleSelfMessage(msg);
      await handleMentions(msg);
    } catch (e) {
      console.error("[afk-listener] erro:", e);
    }
  });
}
