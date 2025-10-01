import 'dotenv/config';
import { MisedBot } from './bot/core/Bot.js';
import { Mongo } from './bot/db/Mongo.js';
//import { MySQLPool } from './bot/db/MySQLPool.js';
import { registerVoiceStateHandler } from "./bot/handlers/voiceState.js";
import { registerPontoButtons } from "./bot/handlers/interactions.js";
import { ConvertJobDao } from "./bot/db/ConvertJobDao.js";
import { AfkDao } from './bot/db/AfkDao.js';
import { registerAfkListener } from './bot/listeners/afk-listener.js';
import { registerLevelingListener } from './bot/listeners/leveling-listener.js';
import { LevelingDao } from './bot/db/LevelingDao.js';
import { InvitesDao } from './bot/db/InvitesDao.js';
import { registerInviteTracker } from './bot/listeners/invite-tracker.js';
import { NotifyDao } from './bot/db/NotifyDao.js';
import { startNotifyScheduler } from './bot/notify/poller.js';
import { VerifyDao } from './bot/db/VerifyDao.js';
import { registerVerifier } from './bot/listeners/verifier-listener.js';

async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('Defina DISCORD_TOKEN no .env');

  await Mongo.connect();
  //await MySQLPool.connect();

  const bot = new MisedBot();
  registerVoiceStateHandler(bot, Mongo.getDb());
  registerPontoButtons(bot, Mongo.getDb());
  registerAfkListener(bot);
  registerLevelingListener(bot);
  registerInviteTracker(bot);
  startNotifyScheduler(bot);
  registerVerifier(bot);

  await VerifyDao.ensureIndexes();
  await NotifyDao.ensureIndexes();
  await InvitesDao.ensureIndexes();
  await LevelingDao.ensureIndexes();
  await ConvertJobDao.ensureIndexes();
  await AfkDao.ensureIndexes();
  await bot.start(token);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
