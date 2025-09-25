
import { Mongo } from './Mongo.js';
export interface AutoroleConfig {
  guildId: string;
  enabled: boolean;
  roleIds: string[];
}
export class AutoroleConfigDao {
  static col() { return Mongo.getDb().collection<AutoroleConfig>('autorole_config'); }
  static async get(guildId: string): Promise<AutoroleConfig | null> {
    return this.col().findOne({ guildId });
  }
  static async set(guildId: string, enabled: boolean, roleIds: string[]) {
    await this.col().updateOne({ guildId }, { $set: { guildId, enabled, roleIds } }, { upsert: true });
  }
}
