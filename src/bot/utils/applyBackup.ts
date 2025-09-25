import {
  Guild, PermissionFlagsBits, ChannelType, OverwriteType, Role
} from "discord.js";
import {
  GuildSnapshot, AnyChannelSnapshot, CategorySnapshot, RoleSnapshot
} from "../../types";

/**
 * Aplica um snapshot no servidor de destino.
 * - Cria/atualiza cargos e reordena (na medida do possível)
 * - Cria categorias e canais, ajusta overwrites
 * - Estratégia: recriar estrutura (não apaga tudo automaticamente)
 *   Você pode mudar para "reset total" se quiser (perigoso).
 */
export async function applyBackup(guild: Guild, snap: GuildSnapshot) {
  // 1) ROLES
  const roleMap = new Map<string, Role>(); // oldRoleId -> newRole

  // @everyone: atualiza permissões
  const everyone = guild.roles.everyone;
  if (everyone && snap.everyone) {
    await everyone.setPermissions(BigInt(snap.everyone.permissions));
  }

  // Cria/garante os cargos (exceto @everyone)
  // Obs.: manter posição exata pode exigir reordenação por editPositions (limitado pela API)
  // Aqui criamos e depois tentamos aproximar a ordenação.
  for (const r of snap.roles) {
    let role = guild.roles.cache.find(rr => rr.name === r.name && rr.id !== guild.id);
    if (!role) {
      role = await guild.roles.create({
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        mentionable: r.mentionable,
        permissions: BigInt(r.permissions),
        reason: `Apply backup: creating role ${r.name}`
      });
    } else {
      await role.edit({
        color: r.color,
        hoist: r.hoist,
        mentionable: r.mentionable,
        permissions: BigInt(r.permissions)
      });
    }
    roleMap.set(r.id, role);
  }

  // (Opcional) tentar reordenar pela ordem do snapshot — a API limita operações em massa
  // Você pode implementar uma rotina de bubble-up editPositions, mas é lento.
  // Dica: priorize ordem de papéis críticos manualmente se necessário.

  // 2) CATEGORIAS
  const categoryIdMap = new Map<string, string>(); // oldCatId -> newCatId

  const categoriesSorted = [...snap.categories].sort((a, b) => a.position - b.position);
  for (const cat of categoriesSorted) {
    // procura por nome e posição similar
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && (c as any).name === cat.name
    );
    if (!category) {
      category = await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        reason: `Apply backup: creating category ${cat.name}`
      });
    } else {
      await (category as any).edit({ name: cat.name });
    }
    categoryIdMap.set(cat.id, category.id);
  }

  // 3) CANAIS
  const byPosition = [...snap.channels].sort((a, b) => a.position - b.position);

  for (const ch of byPosition) {
    const parentId = ch.parentId ? categoryIdMap.get(ch.parentId) ?? null : null;

    // tenta encontrar por nome dentro da mesma categoria
    let existing = guild.channels.cache.find(cc => {
      if (cc.type !== (ch.type === "GUILD_TEXT" ? ChannelType.GuildText : ChannelType.GuildVoice)) return false;
      if ((cc as any).name !== ch.name) return false;
      if ((cc as any).parentId !== parentId) return false;
      return true;
    });

    if (!existing) {
      // criar
      if (ch.type === "GUILD_TEXT") {
        existing = await guild.channels.create({
          name: ch.name,
          type: ChannelType.GuildText,
          parent: parentId ?? undefined,
          topic: ch.topic ?? undefined,
          rateLimitPerUser: ch.rateLimitPerUser ?? undefined,
          nsfw: ch.nsfw ?? false,
          reason: `Apply backup: creating text channel ${ch.name}`
        });
      } else {
        existing = await guild.channels.create({
          name: ch.name,
          type: ChannelType.GuildVoice,
          parent: parentId ?? undefined,
          bitrate: ch.bitrate ?? undefined,
          userLimit: ch.userLimit ?? undefined,
          reason: `Apply backup: creating voice channel ${ch.name}`
        });
      }
    } else {
      // atualizar propriedades principais
      if (ch.type === "GUILD_TEXT") {
        await (existing as any).edit({
          name: ch.name,
          parent: parentId ?? undefined,
          topic: ch.topic ?? undefined,
          rateLimitPerUser: ch.rateLimitPerUser ?? undefined,
          nsfw: ch.nsfw ?? false
        });
      } else {
        await (existing as any).edit({
          name: ch.name,
          parent: parentId ?? undefined,
          bitrate: ch.bitrate ?? undefined,
          userLimit: ch.userLimit ?? undefined
        });
      }
    }

    // OVERWRITES (somente de roles)
    if (existing && "permissionOverwrites" in existing) {
      // Limpa overwrites de roles que vamos setar (opcional: pode mesclar)
      // Estratégia: recriar os overwrites de roles capturados.
      const overwrites = ch.permissionOverwrites.map(ow => {
        const targetRole = roleMap.get(ow.id) || (ow.id === guild.id ? guild.roles.everyone : null);
        if (!targetRole) return null;
        return {
          id: targetRole.id,
          type: OverwriteType.Role,
          allow: BigInt(ow.allow),
          deny: BigInt(ow.deny)
        };
      }).filter(Boolean) as any[];

      await (existing as any).permissionOverwrites.set(overwrites, { reason: "Apply backup: overwrite sync" });
    }
  }
}
