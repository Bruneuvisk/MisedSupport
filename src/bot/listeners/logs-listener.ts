import {
  Client,
  EmbedBuilder,
  Events,
  GuildMember,
  Message,
  PartialMessage,
  User,
  ChannelType,
  Role,
  PartialGuildMember
} from "discord.js";
import { LogConfigDao } from "../db/LogConfigDao.js";

async function getLogChannel(client: Client, guildId: string) {
  const cfg = await LogConfigDao.get(guildId);
  if (!cfg || !cfg.enabled) return null;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;
  return guild.channels.cache.get(cfg.channelId) ?? await guild.channels.fetch(cfg.channelId).catch(() => null);
}

export function registerLogs(client: Client) {
  // ===== MEMBER EVENTS =====
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    const ch = await getLogChannel(client, member.guild.id);
    if (!ch?.isTextBased()) return;
    const embed = new EmbedBuilder()
      .setTitle("👋 Membro entrou")
      .setDescription(`${member.user} entrou no servidor.`)
      .setThumbnail(member.user.displayAvatarURL())
      .setColor(0x2ecc71)
      .setTimestamp();
    await ch.send({ embeds: [embed] });
  });

  client.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
  const guildId = member.guild.id;                    // ok nos dois tipos
  const userTag = member.user?.tag ?? member.id;      // user pode faltar no Partial
  const ch = await getLogChannel(client, guildId);
  if (!ch?.isTextBased()) return;

  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🚪 Membro saiu")
        .setDescription(`${userTag} saiu ou foi removido.`)
        .setColor(0xe67e22)
        .setTimestamp(),
    ],
  });
});

  client.on(Events.GuildBanAdd, async ban => {
    const ch = await getLogChannel(client, ban.guild.id);
    if (!ch?.isTextBased()) return;
    const embed = new EmbedBuilder()
      .setTitle("⛔ Banimento")
      .setDescription(`Usuário **${ban.user.tag}** foi banido.`)
      .setColor(0xe74c3c)
      .setTimestamp();
    await ch.send({ embeds: [embed] });
  });

  client.on(Events.GuildBanRemove, async ban => {
    const ch = await getLogChannel(client, ban.guild.id);
    if (!ch?.isTextBased()) return;
    const embed = new EmbedBuilder()
      .setTitle("✅ Desbanimento")
      .setDescription(`Usuário **${ban.user.tag}** foi desbanido.`)
      .setColor(0x3498db)
      .setTimestamp();
    await ch.send({ embeds: [embed] });
  });

  // ===== MESSAGE EVENTS =====
  client.on(Events.MessageDelete, async (msg: Message | PartialMessage) => {
    if (!msg.guild || msg.partial) return;
    const ch = await getLogChannel(client, msg.guild.id);
    if (!ch?.isTextBased()) return;
    const embed = new EmbedBuilder()
      .setTitle("🗑️ Mensagem deletada")
      .addFields(
        { name: "Autor", value: msg.author?.tag ?? "Desconhecido", inline: true },
        { name: "Canal", value: `<#${msg.channelId}>`, inline: true },
      )
      .setDescription(msg.content || "*sem conteúdo*")
      .setColor(0xc0392b)
      .setTimestamp();
    await ch.send({ embeds: [embed] });
  });

  client.on(Events.MessageUpdate, async (oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage) => {
    if (!newMsg.guild || newMsg.partial || oldMsg.partial) return;
    if (oldMsg.content === newMsg.content) return;
    const ch = await getLogChannel(client, newMsg.guild.id);
    if (!ch?.isTextBased()) return;
    const embed = new EmbedBuilder()
      .setTitle("✏️ Mensagem editada")
      .addFields(
        { name: "Autor", value: newMsg.author?.tag ?? "Desconhecido", inline: true },
        { name: "Canal", value: `<#${newMsg.channelId}>`, inline: true },
      )
      .addFields(
        { name: "Antes", value: oldMsg.content || "*sem conteúdo*" },
        { name: "Depois", value: newMsg.content || "*sem conteúdo*" },
      )
      .setColor(0xf1c40f)
      .setTimestamp();
    await ch.send({ embeds: [embed] });
  });

  // ===== ROLE UPDATES =====
  client.on(Events.GuildMemberUpdate, async (oldMem, newMem) => {
    const ch = await getLogChannel(client, newMem.guild.id);
    if (!ch?.isTextBased()) return;

    // mudança de apelido
    if (oldMem.nickname !== newMem.nickname) {
      const embed = new EmbedBuilder()
        .setTitle("🔄 Apelido alterado")
        .setDescription(`${newMem.user.tag}`)
        .addFields(
          { name: "Antes", value: oldMem.nickname ?? "Nenhum" },
          { name: "Depois", value: newMem.nickname ?? "Nenhum" },
        )
        .setColor(0x9b59b6)
        .setTimestamp();
      await ch.send({ embeds: [embed] });
    }

    // cargos alterados
    const oldRoles = oldMem.roles.cache.map(r => r.id);
    const newRoles = newMem.roles.cache.map(r => r.id);
    if (oldRoles.length !== newRoles.length) {
      const added = newRoles.filter(r => !oldRoles.includes(r));
      const removed = oldRoles.filter(r => !newRoles.includes(r));

      const embed = new EmbedBuilder()
        .setTitle("🎭 Cargos atualizados")
        .setDescription(`${newMem.user.tag}`)
        .setColor(0x2980b9)
        .setTimestamp();

      if (added.length) embed.addFields({ name: "Adicionados", value: added.map(r => `<@&${r}>`).join(", ") });
      if (removed.length) embed.addFields({ name: "Removidos", value: removed.map(r => `<@&${r}>`).join(", ") });

      await ch.send({ embeds: [embed] });
    }
  });
 client.on(Events.ChannelCreate, async (channel) => {
    // ignore DMs
    if (channel.isDMBased()) return;

    const guildId = channel.guild.id;                     // agora o TS sabe que é guild
    const ch = await getLogChannel(client, guildId);
    if (!ch?.isTextBased()) return;

    const name = channel.name;

    await ch.send({
        embeds: [
        new EmbedBuilder()
            .setTitle("📢 Canal criado")
            .setDescription(`Canal: ${"name" in channel ? `<#${channel.id}>` : name}`)
            .setColor(0x2ecc71)
            .setTimestamp(),
        ],
    });
});

client.on(Events.ChannelDelete, async (channel) => {
  if (channel.isDMBased()) return;

  const guildId = channel.guild.id;
  const ch = await getLogChannel(client, guildId);
  if (!ch?.isTextBased()) return;

  const name = channel.name

  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("📢 Canal deletado")
        .setDescription(`Canal: ${name}`)
        .setColor(0xe74c3c)
        .setTimestamp(),
    ],
  });
});
}
