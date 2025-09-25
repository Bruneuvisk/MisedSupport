import { Mongo } from './Mongo.js';

export interface WLSession {
  guildId: string;
  userId: string;
  step: number;
  name?: string;
  age?: number;
  gameId?: string;
  answers: string[];
  backstory?: string;
  open: boolean;
  createdAt: number;
}

export class WhitelistSessionDao {
  static col() { return Mongo.getDb().collection<WLSession>('whitelist_session'); }

  static async start(guildId: string, userId: string) {
    const now = Date.now();
    await this.col().updateOne(
      { guildId, userId },
      { $set: { guildId, userId, step: -1, answers: [], open: true, createdAt: now } },
      { upsert: true }
    );
  }

  static async get(guildId: string, userId: string) {
    return this.col().findOne({ guildId, userId, open: true }) as Promise<WLSession | null>;
  }

  static async setBasics(guildId: string, userId: string, name: string, age: number, gameId: string) {
    await this.col().updateOne({ guildId, userId, open: true }, { $set: { name, age, gameId, step: 0 } });
  }

  static async pushAnswer(guildId: string, userId: string, answer: 'agree'|'neutral'|'disagree') {
    await this.col().updateOne({ guildId, userId, open: true }, { $push: { answers: answer }, $inc: { step: 1 } });
  }

  static async setBackstory(guildId: string, userId: string, backstory: string) {
    await this.col().updateOne({ guildId, userId, open: true }, { $set: { backstory } });
  }

  static async close(guildId: string, userId: string) {
    await this.col().updateOne({ guildId, userId, open: true }, { $set: { open: false } });
  }
}
