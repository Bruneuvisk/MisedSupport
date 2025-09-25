import { Mongo } from './Mongo.js';

export type GifMode = 'convert' | 'compress';

export interface GifSession {
  guildId: string;
  channelId: string;
  userId: string;
  mode: GifMode;
  open: boolean;
  createdAt: number;
}

export class GifSessionDao {
  static col() { return Mongo.getDb().collection<GifSession>('gif_session'); }

  static async create(guildId: string, channelId: string, userId: string, mode: GifMode) {
    await this.col().insertOne({ guildId, channelId, userId, mode, open: true, createdAt: Date.now() });
  }

  static async getByChannel(channelId: string) {
    return this.col().findOne({ channelId, open: true }) as Promise<GifSession | null>;
  }

  static async close(channelId: string) {
    await this.col().updateOne({ channelId, open: true }, { $set: { open: false } });
  }
}
