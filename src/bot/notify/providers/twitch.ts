import axios from "axios";
import type { Provider, ProviderFetchResult, ProviderItem } from "./types.js";
import { NotifyDao } from "../../db/NotifyDao.js";

// Consulta stream ao vivo. Recomendado usar `user_login` como sourceId.
async function getAppAccessToken(): Promise<string> {
  const id = process.env.TWITCH_CLIENT_ID!;
  const secret = process.env.TWITCH_CLIENT_SECRET!;
  if (!id || !secret) throw new Error("Defina TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET");

  const cached = await NotifyDao.getTwitchToken();
  const now = Date.now();
  if (cached && cached.expiresAt - 60_000 > now) return cached.accessToken;

  const form = new URLSearchParams();
  form.set("client_id", id);
  form.set("client_secret", secret);
  form.set("grant_type", "client_credentials");

  const { data } = await axios.post("https://id.twitch.tv/oauth2/token", form, { timeout: 15000 });
  const accessToken = data.access_token as string;
  const expiresAt = now + (data.expires_in as number) * 1000;
  await NotifyDao.setTwitchToken({ _id: "twitch", accessToken, expiresAt });
  return accessToken;
}

export const TwitchProvider: Provider = {
  platform: "twitch",
  async fetch(userLogin: string): Promise<ProviderFetchResult | null> {
    const clientId = process.env.TWITCH_CLIENT_ID!;
    const token = await getAppAccessToken();

    // 1) info do usuário (pegar display_name)
    const ures = await axios.get("https://api.twitch.tv/helix/users", {
      params: { login: userLogin },
      headers: { "Client-Id": clientId, "Authorization": `Bearer ${token}` },
      timeout: 15000
    });
    const user = ures.data?.data?.[0];
    if (!user) return null;

    // 2) stream atual (se está ao vivo)
    const sres = await axios.get("https://api.twitch.tv/helix/streams", {
      params: { user_id: user.id },
      headers: { "Client-Id": clientId, "Authorization": `Bearer ${token}` },
      timeout: 15000
    });
    const stream = sres.data?.data?.[0] ?? null;

    const items: ProviderItem[] = [];
    if (stream) {
      items.push({
        id: `live:${stream.id}`,
        title: stream.title,
        url: `https://twitch.tv/${user.login}`,
        publishedAt: Date.parse(stream.started_at),
        author: user.display_name,
        thumbnail: stream.thumbnail_url?.replace("{width}", "1280")?.replace("{height}", "720"),
      });
    }
    return { sourceName: user.display_name, items };
  }
};
