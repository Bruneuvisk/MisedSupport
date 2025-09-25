
import { Mongo } from './Mongo.js';
export interface Giveaway {
  guildId: string;
  channelId: string;
  messageId?: string;
  prize: string;
  endsAt: number; // epoch seconds
  winners: number;
  entrants: string[];
  ended?: boolean;
}
export class GiveawayDao {
  static col() { return Mongo.getDb().collection<Giveaway>('giveaways'); }
  static create(g: Giveaway) { return this.col().insertOne(g); }
  static async addEntrant(messageId: string, userId: string) {
    await this.col().updateOne({ messageId, ended: { $ne: true } }, { $addToSet: { entrants: userId } });
  }
  static async endNow(messageId: string) {
    await this.col().updateOne({ messageId }, { $set: { ended: true } });
  }
  static async findDue(now: number) {
    return this.col().find({ ended: { $ne: true }, endsAt: { $lte: now } }).toArray();
  }
  static async setMessageId(insertedId: any, messageId: string) {
    await this.col().updateOne({ _id: insertedId }, { $set: { messageId } });
  }
  static async byMessage(messageId: string) { return this.col().findOne({ messageId }); }
}
