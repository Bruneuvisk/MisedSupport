import { Client, Events, Message, TextBasedChannel } from "discord.js";
import { LevelingDao } from "../db/LevelingDao.js";
import { addXpAndCalcLevel } from "../utils/leveling.js";

// cooldown em memória (reset ao reiniciar o processo)
const cooldown = new Map<string, number>(); // key = `${guildId}:${userId}` -> timestamp (ms)

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function registerLevelingListener(client: Client) {
  client.on(Events.MessageCreate, async (msg: Message) => {
    try {
      if (!msg.guild || msg.author.bot) return;
      if (!msg.member) return;

      // configurações da guild
      const cfg = await LevelingDao.getConfig(msg.guild.id);

      // cooldown
      const key = `${msg.guild.id}:${msg.author.id}`;
      const now = Date.now();
      const until = cooldown.get(key) ?? 0;
      if (now < until) return;
      cooldown.set(key, now + cfg.cooldownSec * 1000);

      // ganho aleatório entre [xpMin, xpMax]
      const gain = randInt(cfg.xpMin, cfg.xpMax);

      // pega usuário / cria se não existe
      const user = await LevelingDao.getUser(msg.guild.id, msg.author.id);
      const currXp = user?.xp ?? 0;
      const currLevel = user?.level ?? 0;

      const { xp, level, leveledUp } = addXpAndCalcLevel(currXp, currLevel, gain);
      await LevelingDao.upsertUser(msg.guild.id, msg.author.id, { xp, level });

      // anúncio + recompensa
      if (leveledUp && cfg.announceLevelUp) {
        if (!msg.channel.isTextBased()) return;

        await msg.reply({
            content: `🎉 ${msg.member} subiu para o **nível ${level}**! (+${gain} XP)`,
            allowedMentions: { users: [msg.author.id] },
        });

        // recompensa de cargo (se houver para esse level)
        try {
          const rewards = await LevelingDao.listRewards(msg.guild.id);
          const reward = rewards.find(r => r.level === level);
          if (reward) {
            const role = msg.guild.roles.cache.get(reward.roleId) ?? await msg.guild.roles.fetch(reward.roleId).catch(() => null);
            if (role && msg.member.manageable) {
              await msg.member.roles.add(role, `Recompensa por atingir nível ${level}`);
            }
          }
        } catch (e) {
          console.error("[leveling] erro ao atribuir cargo:", e);
        }
      }
    } catch (e) {
      console.error("[leveling] erro:", e);
    }
  });
}
