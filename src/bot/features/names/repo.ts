import { namesConfig } from "./collections.js";
import type { NameCategory, NameCategoryConfig } from "./types.js";

export async function upsertCategoryConfig(
  guildId: string,
  category: NameCategory,
  patch: Partial<NameCategoryConfig>
) {
  await namesConfig().updateOne(
    { guildId, category },
    { $set: { guildId, category, updatedAt: new Date(), ...patch }, $setOnInsert: { mentionRoleIds: [], enabled: true } },
    { upsert: true }
  );
  return namesConfig().findOne({ guildId, category });
}

export async function getCategoryConfig(guildId: string, category: NameCategory) {
  return namesConfig().findOne({ guildId, category });
}

export async function listConfigs(guildId: string) {
  return namesConfig().find({ guildId }).toArray();
}

export async function addMentionRole(guildId: string, category: NameCategory, roleId: string) {
  await namesConfig().updateOne(
    { guildId, category },
    { $addToSet: { mentionRoleIds: roleId }, $set: { updatedAt: new Date(), enabled: true } },
    { upsert: true }
  );
  return getCategoryConfig(guildId, category);
}

export async function removeMentionRole(guildId: string, category: NameCategory, roleId: string) {
  await namesConfig().updateOne(
    { guildId, category },
    { $pull: { mentionRoleIds: roleId }, $set: { updatedAt: new Date() } }
  );
  return getCategoryConfig(guildId, category);
}

export async function setChannel(guildId: string, category: NameCategory, channelId: string | null) {
  return upsertCategoryConfig(guildId, category, { channelId, enabled: true });
}

export async function setEnabled(guildId: string, category: NameCategory, enabled: boolean) {
  return upsertCategoryConfig(guildId, category, { enabled });
}
