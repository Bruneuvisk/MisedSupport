import { Client, Guild, Invite } from "discord.js";

/** Guarda, por guild, o mapa {code -> uses} e o ownerId do convite */
export class InviteCache {
  private codes = new Map<string, Map<string, { uses: number; inviterId: string | null }>>();

  async primeGuild(guild: Guild) {
    try {
      const invites = await guild.invites.fetch().catch(() => null);
      const map = new Map<string, { uses: number; inviterId: string | null }>();
      invites?.forEach(inv => {
        map.set(inv.code, { uses: inv.uses ?? 0, inviterId: inv.inviterId ?? null });
      });
      this.codes.set(guild.id, map);
    } catch {}
  }

  async primeAll(client: Client) {
    await Promise.all(client.guilds.cache.map(g => this.primeGuild(g)));
  }

  onInviteCreate(guildId: string, invite: Invite) {
    const g = this.codes.get(guildId) ?? new Map();
    g.set(invite.code, { uses: invite.uses ?? 0, inviterId: invite.inviterId ?? null });
    this.codes.set(guildId, g);
  }

  onInviteDelete(guildId: string, code: string) {
    const g = this.codes.get(guildId);
    g?.delete(code);
  }

  /** retorna {code, inviterId} cujo uses aumentou; se nenhum, retorna null */
  detectUsed(guildId: string, afterInvites: Map<string, { uses: number; inviterId: string | null }>) {
    const before = this.codes.get(guildId);
    if (!before) return null;
    for (const [code, after] of afterInvites.entries()) {
      const prev = before.get(code);
      if (!prev) continue;
      if ((after.uses ?? 0) > (prev.uses ?? 0)) {
        return { code, inviterId: after.inviterId };
      }
    }
    return null;
  }

  updateSnapshot(guildId: string, snapshot: Map<string, { uses: number; inviterId: string | null }>) {
    this.codes.set(guildId, snapshot);
  }
}
