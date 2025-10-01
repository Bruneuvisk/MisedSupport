import {
  Guild, ChannelType, Role, OverwriteType,
} from "discord.js";
import {
  GuildSnapshot, RoleSnapshot, CategorySnapshot,
  AnyChannelSnapshot, TextChannelSnapshot, VoiceChannelSnapshot
} from "../../types.js";

/**
 * Cria um snapshot completo e ordenado do servidor:
 * - Roles (com @everyone separado)
 * - Categorias
 * - Canais (texto e voz) com overwrites de permissão (apenas de roles)
 */
export async function snapshotGuild(guild: Guild, note?: string): Promise<GuildSnapshot> {
  await guild.roles.fetch();
  await guild.channels.fetch();

  // --- Roles ---
  const rolesSorted = guild.roles.cache
    .filter(r => r.id !== guild.id) // remove @everyone aqui
    .sort((a, b) => a.position - b.position);

  const toRoleSnap = (r: Role): RoleSnapshot => ({
    id: r.id,
    name: r.name,
    color: r.color,
    hoist: r.hoist,
    mentionable: r.mentionable,
    permissions: r.permissions.bitfield.toString(),
    position: r.position,
    icon: r.icon ?? null,
    unicodeEmoji: (r as any).unicodeEmoji ?? null
  });

  const roles = rolesSorted.map(toRoleSnap);

  const everyoneRole = guild.roles.cache.get(guild.id)!;
  const everyone = {
    id: everyoneRole.id,
    name: everyoneRole.name,
    color: everyoneRole.color,
    hoist: everyoneRole.hoist,
    mentionable: everyoneRole.mentionable,
    permissions: everyoneRole.permissions.bitfield.toString(),
    icon: everyoneRole.icon ?? null,
    unicodeEmoji: (everyoneRole as any).unicodeEmoji ?? null
  };

  // --- Categorias ---
  const categories: CategorySnapshot[] = guild.channels.cache
    .filter(ch => ch.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position)
    .map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      position: cat.position,
      type: "GUILD_CATEGORY"
    }));

  // --- Canais (texto/voz) ---
  const channels: AnyChannelSnapshot[] = guild.channels.cache
    .filter(ch => ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildVoice)
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((ch: any) => {
      const permOverwrites = ch.permissionOverwrites.cache
        .filter((ow: any) => ow.type === OverwriteType.Role) // só roles
        .map((ow: any) => ({
          id: ow.id,
          type: ow.type,
          allow: ow.allow.bitfield.toString(),
          deny: ow.deny.bitfield.toString()
        }));

      if (ch.type === ChannelType.GuildText) {
        const t: TextChannelSnapshot = {
          id: ch.id,
          type: "GUILD_TEXT",
          name: ch.name,
          position: ch.rawPosition,
          parentId: ch.parentId ?? null,
          permissionOverwrites: permOverwrites,
          topic: ch.topic ?? null,
          rateLimitPerUser: ch.rateLimitPerUser ?? null,
          nsfw: ch.nsfw ?? false
        };
        return t;
      } else {
        const v: VoiceChannelSnapshot = {
          id: ch.id,
          type: "GUILD_VOICE",
          name: ch.name,
          position: ch.rawPosition,
          parentId: ch.parentId ?? null,
          permissionOverwrites: permOverwrites,
          bitrate: ch.bitrate ?? null,
          userLimit: ch.userLimit ?? null,
          nsfw: false
        };
        return v;
      }
    });

  return {
    guildId: guild.id,
    name: guild.name,
    createdAt: new Date(),
    roles,
    everyone,
    categories,
    channels,
    note
  };
}
