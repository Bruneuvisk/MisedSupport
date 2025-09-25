
import { Mongo } from './Mongo.js';
export interface AntispamConfig {
  guildId: string;
  enabled: boolean;
  msgsPer10s: number;
  timeoutSeconds: number;
}
export class AntispamConfigDao {
  static col() { return Mongo.getDb().collection<AntispamConfig>('antispam_config'); }
  static async get(guildId: string) { return this.col().findOne({ guildId }); }
  static async set(guildId: string, enabled: boolean, msgsPer10s: number, timeoutSeconds: number) {
    await this.col().updateOne({ guildId }, { $set: { guildId, enabled, msgsPer10s, timeoutSeconds } }, { upsert: true });
  }
}
