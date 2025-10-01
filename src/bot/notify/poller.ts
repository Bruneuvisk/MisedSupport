import { Client, TextBasedChannel, GuildTextBasedChannel } from "discord.js";
import { NotifyDao } from "../db/NotifyDao.js";
import { YouTubeProvider } from "./providers/youtube.js";
import { TwitchProvider } from "./providers/twitch.js";
import type { Provider, ProviderItem } from "./providers/types.js";

const providers: Record<string, Provider> = {
  youtube: YouTubeProvider,
  twitch: TwitchProvider,
};

function renderTemplate(tpl: string, data: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => data[k] ?? "");
}

function isGuildText(ch: any): ch is GuildTextBasedChannel {
  return !!ch && typeof ch.isTextBased === "function" && ch.isTextBased() && !ch.isDMBased?.();
}

async function postToGuild(client: Client, guildId: string, content: string) {
  const cfg = await NotifyDao.getGuildCfg(guildId);
  if (!cfg.enabled || !cfg.channelId) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const ch = guild.channels.cache.get(cfg.channelId) ?? await guild.channels.fetch(cfg.channelId).catch(() => null);
  if (!isGuildText(ch)) return;

  await ch.send({ content }); // agora tipado corretamente
}
export async function runNotifyTick(client: Client) {
  // para cada guild, puxa suas subs
  for (const guild of client.guilds.cache.values()) {
    const cfg = await NotifyDao.getGuildCfg(guild.id);
    if (!cfg.enabled || !cfg.channelId) continue;

    const subs = await NotifyDao.listSubs(guild.id);
    for (const sub of subs) {
      if (!sub.enabled) continue;
      const provider = providers[sub.platform];
      if (!provider) continue;

      try {
        const res = await provider.fetch(sub.sourceId);
        if (!res || !res.items.length) continue;

        // pegue itens novos (mais recentes que o checkpoint)
        const checkpoint = sub.lastPublishedAt ?? 0;
        const fresh = res.items
          .filter(i => (i.publishedAt > checkpoint) && i.id !== sub.lastItemId)
          .sort((a, b) => a.publishedAt - b.publishedAt); // enviar em ordem cronológica

        if (!fresh.length) continue;

        // template (preferir custom do sub, senão da guild, senão default)
        const tpl = sub.customTemplate
          ? sub.customTemplate
          : (cfg.template ?? "**{name}** publicou **{title}**\n{url}");

        for (const item of fresh) {
          const msg = renderTemplate(tpl, {
            name: res.sourceName,
            title: item.title,
            url: item.url,
            id: item.id,
            platform: sub.platform,
          });
          await postToGuild(client, guild.id, msg);
          await NotifyDao.updateCheckpoint(sub._id, item.id, item.publishedAt);
          // anti flood entre vários itens
          await new Promise(r => setTimeout(r, 800));
        }
      } catch (e) {
        console.error("[notify] erro ao processar", sub.platform, sub.sourceId, e);
      }
    }
  }
}

let timer: NodeJS.Timeout | null = null;

export async function startNotifyScheduler(client: Client) {
  if (timer) return;
  // tick imediato
  runNotifyTick(client).catch(() => {});
  // tick periódico (usa menor intervalo entre guilds, mas simples aqui: 60s)
  timer = setInterval(() => runNotifyTick(client).catch(() => {}), 60_000);
}

export function stopNotifyScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
