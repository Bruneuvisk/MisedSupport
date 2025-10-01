import {
  Client,
  Events,
  Guild,
  Invite,
  GuildMember,
  PartialGuildMember,
  TextBasedChannel,
} from "discord.js";
import { InvitesDao } from "../db/InvitesDao.js";

// cache: guildId -> Map<code, { uses, inviterId|null }>
const inviteCache = new Map<string, Map<string, { uses: number; inviterId: string | null }>>();

async function loadGuildInvites(guild: Guild) {
  const map = new Map<string, { uses: number; inviterId: string | null }>();
  // fetch todos os convites atuais (pode falhar sem permissão "Manage Guild")
  const invites = await guild.invites.fetch().catch(() => null);
  if (invites) {
    invites.forEach(inv => {
      map.set(inv.code, { uses: inv.uses ?? 0, inviterId: inv.inviterId ?? null });
    });
  }
  inviteCache.set(guild.id, map);

  // persiste snapshot
  if (invites) {
    for (const inv of invites.values()) {
      await InvitesDao.setSnapshot(guild.id, inv.code, {
        inviterId: inv.inviterId ?? null,
        uses: inv.uses ?? 0,
        maxUses: inv.maxUses ?? null,
        createdTimestamp: inv.createdTimestamp ?? null,
      });
    }
  }
}

async function refreshInvite(guild: Guild, code: string) {
  const inv = await guild.invites.fetch(code).catch(() => null);
  const map = inviteCache.get(guild.id) ?? new Map();
  if (inv) {
    map.set(inv.code, { uses: inv.uses ?? 0, inviterId: inv.inviterId ?? null });
    await InvitesDao.setSnapshot(guild.id, inv.code, {
      inviterId: inv.inviterId ?? null,
      uses: inv.uses ?? 0,
      maxUses: inv.maxUses ?? null,
      createdTimestamp: inv.createdTimestamp ?? null,
    });
  } else {
    map.delete(code);
  }
  inviteCache.set(guild.id, map);
}

// encontra invite cujo "uses" aumentou
function detectUsedInvite(prev: Map<string, { uses: number; inviterId: string | null }>, now: Map<string, { uses: number; inviterId: string | null }>) {
  for (const [code, before] of prev.entries()) {
    const after = now.get(code);
    if (after && (after.uses > before.uses)) {
      return { code, inviterId: after.inviterId };
    }
  }
  return null;
}

export function registerInviteTracker(client: Client) {
  client.on(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) {
      await loadGuildInvites(guild);
    }
  });

  client.on(Events.GuildCreate, async guild => {
    await loadGuildInvites(guild);
  });

  client.on(Events.InviteCreate, async invite => {
    const map = inviteCache.get(invite.guild!.id) ?? new Map();
    map.set(invite.code, { uses: invite.uses ?? 0, inviterId: invite.inviterId ?? null });
    inviteCache.set(invite.guild!.id, map);
    await InvitesDao.setSnapshot(invite.guild!.id, invite.code, {
      inviterId: invite.inviterId ?? null,
      uses: invite.uses ?? 0,
      maxUses: invite.maxUses ?? null,
      createdTimestamp: invite.createdTimestamp ?? null,
    });
  });

  client.on(Events.InviteDelete, async invite => {
    const map = inviteCache.get(invite.guild!.id) ?? new Map();
    map.delete(invite.code);
    inviteCache.set(invite.guild!.id, map);
  });

  // novo membro => comparar contadores
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    const guild = member.guild;

    const before = new Map(inviteCache.get(guild.id) ?? new Map());
    const fresh = await guild.invites.fetch().catch(() => null);

    const now = new Map<string, { uses: number; inviterId: string | null }>();
    if (fresh) {
      fresh.forEach(i => now.set(i.code, { uses: i.uses ?? 0, inviterId: i.inviterId ?? null }));
    }
    inviteCache.set(guild.id, now);

    let used: { code: string; inviterId: string | null } | null = null;
    if (fresh) {
      used = detectUsedInvite(before, now);
    }

    // Vanity URL?
    const vanity = guild.vanityURLCode ?? null;
    if (!used && vanity) {
      // entrada por link vanity
      await InvitesDao.setJoin(guild.id, member.id, null, vanity);
      return;
    }

    // Se ainda não sabemos qual convite foi: marca desconhecido
    if (!used) {
      await InvitesDao.setJoin(guild.id, member.id, null, null);
      return;
    }

    // registra join e incrementa stats do convidador
    await InvitesDao.setJoin(guild.id, member.id, used.inviterId ?? null, used.code);
    if (used.inviterId) {
      await InvitesDao.incRegular(guild.id, used.inviterId, 1);
    }
  });

  // membro saiu => incrementa "leaves" do convidador (se conhecido)
  client.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
    const guildId = member.guild.id;
    const join = await InvitesDao.getJoin(guildId, member.id);
    if (join?.inviterId) {
      await InvitesDao.incLeaves(guildId, join.inviterId, 1);
    }
  });
}
