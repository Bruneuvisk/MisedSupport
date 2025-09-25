// src/types.ts
import type { ObjectId } from "mongodb";

export type Snowflake = string;

/* ---------- SNAPSHOT TYPES ---------- */
export interface RoleSnapshot {
  id: Snowflake;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string; // bitfield em string
  position: number;
  icon?: string | null;
  unicodeEmoji?: string | null;
}

export interface ChannelPermissionOverwrite {
  id: Snowflake;   // roleId (somente roles)
  type: number;    // 0 = Role, 1 = Member
  allow: string;   // bitfield em string
  deny: string;    // bitfield em string
}

export interface ChannelSnapshotBase {
  id: Snowflake; // id original (para map interno)
  name: string;
  position: number;
  parentId?: Snowflake | null;
  permissionOverwrites: ChannelPermissionOverwrite[];
  nsfw?: boolean;
}

export interface TextChannelSnapshot extends ChannelSnapshotBase {
  type: "GUILD_TEXT";
  topic: string | null;
  rateLimitPerUser: number | null;
}

export interface VoiceChannelSnapshot extends ChannelSnapshotBase {
  type: "GUILD_VOICE";
  bitrate: number | null;
  userLimit: number | null;
}

export interface CategorySnapshot {
  id: Snowflake;
  name: string;
  position: number;
  type: "GUILD_CATEGORY";
}

export type AnyChannelSnapshot = TextChannelSnapshot | VoiceChannelSnapshot;

export interface GuildSnapshot {
  guildId: Snowflake;
  name: string;
  createdAt: Date;
  roles: RoleSnapshot[]; // sem @everyone
  everyone: Omit<RoleSnapshot, "position">; // @everyone não tem position
  categories: CategorySnapshot[];
  channels: AnyChannelSnapshot[];
  note?: string;
}

/* ---------- SCHEDULE TYPES ---------- */
export type BackupIntervalKind = "off" | "hourly" | "daily" | "weekly";

/* ---------- MONGO DOCUMENTS (driver oficial) ---------- */
export interface BackupDoc {
  _id?: ObjectId;        // <- NECESSÁRIO p/ b._id?.toHexString()
  guildId: string;
  createdBy: string;     // userId ou "system"
  label?: string;
  snapshot: GuildSnapshot;
  createdAt: Date;
}

export interface BackupScheduleDoc {
  _id?: ObjectId;
  guildId: string;
  interval: BackupIntervalKind; // hourly | daily | weekly | off
  hourUTC?: number;             // para daily/weekly (0-23)
  weekdayUTC?: number;          // para weekly (0=Dom..6=Sáb)
  label?: string;
  enabled: boolean;
}
