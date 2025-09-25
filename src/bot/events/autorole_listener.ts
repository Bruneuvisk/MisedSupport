
import { Client, Events, GuildMember } from 'discord.js';
import { AutoroleConfigDao } from '../db/AutoroleConfigDao.js';

export default (client: Client) => {
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    try {
      const cfg = await AutoroleConfigDao.get(member.guild.id);
      if (!cfg?.enabled || !cfg.roleIds?.length) return;
      const roles = cfg.roleIds.filter(r => member.guild.roles.cache.has(r));
      if (!roles.length) return;
      await member.roles.add(roles).catch(() => {});
    } catch (e) {
      console.error('[autorole] erro ao aplicar roles:', e);
    }
  });
};
