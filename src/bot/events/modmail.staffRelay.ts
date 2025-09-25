import {
  type Client,
  type Message,
  ChannelType
} from "discord.js";

import { Mongo } from "../db/Mongo.js";
import {
  getTicketByChannel,
  addMessage,
  getMacro
} from "../features/modmail/repo.js";

// --- Proteções ---
const BOUND_FLAG = Symbol.for("modmail.staff.bound");
const SEEN_GUILD = new Set<string>(); // dedupe por message.id
const SEEN_TTL_MS = 60_000;

export default function bindModmailStaffRelay(client: Client) {
  // evita registrar duas vezes
  if ((client as any)[BOUND_FLAG]) return;
  (client as any)[BOUND_FLAG] = true;

  client.on("messageCreate", async (msg: Message) => {
    try {
      // dedupe: se já vimos esta msg, ignore
      if (SEEN_GUILD.has(msg.id)) return;
      SEEN_GUILD.add(msg.id);
      setTimeout(() => SEEN_GUILD.delete(msg.id), SEEN_TTL_MS);

      // Só mensagens em canais de texto da guild (ignora bots/sistema)
      if (!msg || msg.author?.bot || msg.system) return;
      if (msg.channel.type !== ChannelType.GuildText) return;

      // Garante Mongo conectado
      try { Mongo.getDb(); } catch { await Mongo.connect(); }

      const guild = msg.guild!;
      const ticket = await getTicketByChannel(guild.id, msg.channel.id);
      if (!ticket || ticket.status !== "open") return;

      // Macro rápida: !macro chave
      if (msg.content?.startsWith("!macro ")) {
        const key = msg.content.slice("!macro ".length).trim().toLowerCase();
        const m = await getMacro(guild.id, key);
        if (m) {
          await msg.channel.send(`(macro **${key}**) ${m.text}`);
          msg.content = m.text; // substitui conteúdo a enviar ao usuário
        }
      }

      // Envia staff → DM do usuário
      const user = await client.users.fetch(ticket.userId).catch(() => null);
      if (!user) return;

      try {
        const files = [...msg.attachments.values()]; // Array<Attachment>
        await user.send({
          content: `${msg.content || "_(sem texto)_"}`,
          files: files.length ? files : undefined
        });
      } catch {
        await msg.channel.send("⚠️ Não foi possível enviar DM para o usuário.");
      }

      // Log no Mongo
      await addMessage({
        guildId: guild.id,
        ticketId: ticket._id!,
        from: "staff",
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
      console.error("[modmail.staffRelay] handler error:", err);
    }
  });
}
