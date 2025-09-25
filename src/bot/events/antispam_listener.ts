
import { Client, Collection, Events, Message, PermissionsBitField } from 'discord.js';
import { AntispamConfigDao } from '../db/AntispamConfigDao.js';

export default (client: Client) => {
  const buckets = new Collection<string, { ts: number[] }>();
  client.on(Events.MessageCreate, async (msg: Message) => {
    if (!msg.guild || msg.author.bot) return;
    const cfg = await AntispamConfigDao.get(msg.guild.id);
    if (!cfg?.enabled) return;
    const key = `${msg.guild.id}:${msg.author.id}`;
    const now = Date.now();
    const entry = buckets.get(key) ?? { ts: [] };
    entry.ts.push(now);
    // keep last 10s
    const cut = now - 10000;
    entry.ts = entry.ts.filter(t => t >= cut);
    buckets.set(key, entry);
    if (entry.ts.length > cfg.msgsPer10s) {
      if (msg.member?.moderatable && cfg.timeoutSeconds > 0) {
        await msg.member.timeout(cfg.timeoutSeconds * 1000, 'Antispam').catch(() => {});
      }
    }
  });
};
