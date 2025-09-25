import {
  type Client,
  type Message,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder
} from "discord.js";

import { Mongo } from "../db/Mongo.js";
import {
  getConfig,
  getOpenTicketByUser,
  createTicket,
  addMessage
} from "../features/modmail/repo.js";

// --- Proteções ---
const BOUND_FLAG = Symbol.for("modmail.dm.bound");
const SEEN_DM = new Set<string>(); // dedupe por message.id
const SEEN_TTL_MS = 60_000;        // 60s

export default function bindModmailDM(client: Client) {
  // evita registrar duas vezes
  if ((client as any)[BOUND_FLAG]) return;
  (client as any)[BOUND_FLAG] = true;

  client.on("messageCreate", async (msg: Message) => {
    try {
      // dedupe: se já vimos esta msg, ignore
      if (SEEN_DM.has(msg.id)) return;
      SEEN_DM.add(msg.id);
      setTimeout(() => SEEN_DM.delete(msg.id), SEEN_TTL_MS);

      // Só DM de usuário (ignora bots/sistema)
      if (!msg || msg.author?.bot || msg.system) return;
      if (msg.channel.type !== ChannelType.DM) return;

      // Garante Mongo conectado
      try { Mongo.getDb(); } catch { await Mongo.connect(); }

      // Escolha da guild (ajuste se seu bot atende várias)
      const guild = client.guilds.cache.first();
      if (!guild) return;

      const cfg = await getConfig(guild.id);
      if (!cfg?.inboxCategoryId || !cfg.staffRoleIds?.length) {
        await msg.reply("O suporte não está configurado neste momento. Tente novamente mais tarde.");
        return;
      }

      // Ticket aberto?
      let ticket = await getOpenTicketByUser(guild.id, msg.author.id);
      if (!ticket) {
        // Cria canal do ticket
        const everyoneId = guild.roles.everyone.id;
        const overwrites = [
          { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: client.user!.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          ...cfg.staffRoleIds.map(rid => ({
            id: rid,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }))
        ];

        const channel = await guild.channels.create({
          name: `modmail-${msg.author.username}`.slice(0, 90),
          parent: cfg.inboxCategoryId ?? undefined,
          permissionOverwrites: overwrites,
          topic: `ModMail de ${msg.author.tag} (${msg.author.id})`,
          reason: "Novo ModMail"
        });

        ticket = await createTicket({
          guildId: guild.id,
          userId: msg.author.id,
          channelId: channel.id,
          status: "open",
          createdAt: new Date()
        });

        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("📬 Novo ModMail")
              .setDescription(`Usuário: **${msg.author.tag}** (<@${msg.author.id}>)\nID: \`${msg.author.id}\``)
              .setColor(0x60a5fa)
          ]
        });

        await msg.reply("✅ Sua mensagem foi recebida pelo suporte. A equipe responderá por aqui.");
      }

      // Encaminha DM → canal do ticket
      const inbox = guild.channels.cache.get(ticket.channelId);
      if (inbox?.isTextBased()) {
        const files = [...msg.attachments.values()]; // Array<Attachment>
        await inbox.send({
          content: `**${msg.author.tag}:** ${msg.content || ""}`.trim(),
          files: files.length ? files : undefined
        });
      }

      // Log no Mongo
      await addMessage({
        guildId: guild.id,
        ticketId: ticket._id!,
        from: "user",
        authorId: msg.author.id,
        content: msg.content || undefined,
        attachments: [...msg.attachments.values()].map(a => ({
          name: a.name ?? "file",
          url: a.url,
          contentType: a.contentType ?? null,
          size: a.size ?? null
        })),
        createdAt: new Date()
      });
    } catch (err) {
      console.error("[modmail.dm] handler error:", err);
    }
  });
}
