import 'dotenv/config';
import { MisedBot } from './bot/core/Bot.js';
import { Mongo } from './bot/db/Mongo.js';
//import { MySQLPool } from './bot/db/MySQLPool.js';
import { registerVoiceStateHandler } from "./bot/handlers/voiceState.js";
import { registerPontoButtons } from "./bot/handlers/interactions.js";

async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('Defina DISCORD_TOKEN no .env');

  await Mongo.connect();
  //await MySQLPool.connect();

  const bot = new MisedBot();
  registerVoiceStateHandler(bot, Mongo.getDb());
  registerPontoButtons(bot, Mongo.getDb());
  await bot.start(token);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
