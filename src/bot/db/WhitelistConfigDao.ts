import { Mongo } from './Mongo.js';

export type QuestionCount = 3 | 10 | 15 | 20;

export interface WhitelistConfig {
  guildId: string;
  enabled: boolean;
  applicationChannelId?: string;
  logsApprovedChannelId?: string;
  logsDeniedChannelId?: string;
  logsStaffChannelId?: string;
  roleWithoutWL?: string;
  roleWithWL?: string;
  requireBackstory: boolean;
  questionCount: QuestionCount;
  questions: string[];
  panelMessageId?: string;
  startMessageId?: string;
}

const DEFAULTS: Omit<WhitelistConfig, 'guildId'> = {
  enabled: false,
  applicationChannelId: undefined,
  logsApprovedChannelId: undefined,
  logsDeniedChannelId: undefined,
  logsStaffChannelId: undefined,
  roleWithoutWL: undefined,
  roleWithWL: undefined,
  requireBackstory: false,
  questionCount: 3,
  questions: [],
  panelMessageId: undefined,
  startMessageId: undefined,
};

export class WhitelistConfigDao {
  static col() { return Mongo.getDb().collection<WhitelistConfig>('whitelist_config'); }

  static async get(guildId: string): Promise<WhitelistConfig> {
    const found = await this.col().findOne({ guildId });
    if (!found) {
      const doc: WhitelistConfig = { guildId, ...DEFAULTS };
      await this.col().insertOne(doc);
      return doc;
    }
    return found as WhitelistConfig;
  }

  static async patch(guildId: string, patch: Partial<WhitelistConfig>): Promise<WhitelistConfig> {
    await this.col().updateOne({ guildId }, { $set: { ...patch, guildId } }, { upsert: true });
    return this.get(guildId);
  }
}
