export interface ProviderItem {
  id: string;          // id único (vídeoID / "live:<streamId>")
  title: string;
  url: string;
  publishedAt: number; // epoch ms
  author?: string;
  thumbnail?: string;
}

export interface ProviderFetchResult {
  sourceName: string;         // nome do canal/streamer
  items: ProviderItem[];      // ordenados do mais recente p/ antigo
}

export interface Provider {
  platform: "youtube" | "twitch";
  // sourceId: youtube: channel_id | twitch: login (recomendado)
  fetch(sourceId: string): Promise<ProviderFetchResult | null>;
}
