import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import type { Provider, ProviderFetchResult, ProviderItem } from "./types.js";

// Usa feed oficial (estável): https://www.youtube.com/feeds/videos.xml?channel_id=xxxx
export const YouTubeProvider: Provider = {
  platform: "youtube",
  async fetch(channelId: string): Promise<ProviderFetchResult | null> {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    const { data } = await axios.get<string>(url, { timeout: 15000, responseType: "text" });
    const parser = new XMLParser({ ignoreAttributes: false });
    const doc: any = parser.parse(data);

    const feed = doc?.feed;
    if (!feed) return null;

    const sourceName = feed?.author?.name ?? "Canal";
    const entries = Array.isArray(feed.entry) ? feed.entry : (feed.entry ? [feed.entry] : []);

    const items: ProviderItem[] = entries.map((e: any) => {
      const id = (e["yt:videoId"] ?? e.id) as string;
      return {
        id,
        title: e.title,
        url: e.link?.["@_href"] ?? `https://www.youtube.com/watch?v=${id}`,
        publishedAt: Date.parse(e.published),
        author: sourceName,
        thumbnail: e["media:group"]?.["media:thumbnail"]?.["@_url"],
      };
    }).sort((a: ProviderItem, b: ProviderItem) => b.publishedAt - a.publishedAt);

    return { sourceName, items };
  }
};
