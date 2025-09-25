// src/features/modmail/repo.ts
import { ObjectId } from "mongodb";
import { mmConfigs, mmTickets, mmMessages, mmMacros } from "./collections.js";
import type { ModMailConfig, TicketDoc, MailMessage, MacroDoc } from "./types.js";

export async function getConfig(guildId: string) {
  return mmConfigs().findOne({ guildId });
}

export async function upsertConfig(guildId: string, patch: Partial<ModMailConfig>) {
  const now = new Date();

  // Monta $set só com campos presentes no patch (normalizados)
  const setDoc: Partial<ModMailConfig> & { guildId: string; updatedAt: Date } = {
    guildId,
    updatedAt: now
  };

  if ("inboxCategoryId" in patch) {
    setDoc.inboxCategoryId = patch.inboxCategoryId ?? null;
  }
  if ("logChannelId" in patch) {
    setDoc.logChannelId = patch.logChannelId ?? null;
  }
  if ("staffRoleIds" in patch && Array.isArray(patch.staffRoleIds)) {
    // remove duplicados
    setDoc.staffRoleIds = Array.from(new Set(patch.staffRoleIds));
  }
  if ("autoThread" in patch) {
    setDoc.autoThread = !!patch.autoThread;
  }

  // $setOnInsert só define defaults quando não vier no patch
  const setOnInsert: Partial<ModMailConfig> & { createdAt: Date } = {
    createdAt: now,
    autoThread: false
  };
  if (!("staffRoleIds" in patch)) {
    setOnInsert.staffRoleIds = [];
  }

  await mmConfigs().updateOne(
    { guildId },
    { $set: setDoc, $setOnInsert: setOnInsert },
    { upsert: true }
  );

  return getConfig(guildId);
}

// --- o resto do arquivo pode permanecer igual ---
export async function getOpenTicketByUser(guildId: string, userId: string) {
  return mmTickets().findOne({ guildId, userId, status: "open" });
}
export async function getTicketByChannel(guildId: string, channelId: string) {
  return mmTickets().findOne({ guildId, channelId });
}
export async function createTicket(doc: TicketDoc) {
  const res = await mmTickets().insertOne({ ...doc, createdAt: new Date(), status: "open" });
  return { ...doc, _id: res.insertedId };
}
export async function closeTicket(guildId: string, ticketId: string | ObjectId, by: string) {
  const _id = typeof ticketId === "string" ? new ObjectId(ticketId) : ticketId;
  await mmTickets().updateOne({ _id, guildId }, { $set: { status: "closed", closedAt: new Date(), closedBy: by } });
  return mmTickets().findOne({ _id });
}
export async function addMessage(msg: MailMessage) {
  const res = await mmMessages().insertOne({ ...msg, createdAt: new Date() });
  return { ...msg, _id: res.insertedId };
}
export async function listMessages(ticketId: string | ObjectId) {
  const _id = typeof ticketId === "string" ? new ObjectId(ticketId) : ticketId;
  return mmMessages().find({ ticketId: _id }).sort({ createdAt: 1 }).toArray();
}
export async function setMacro(guildId: string, key: string, text: string) {
  const now = new Date();
  await mmMacros().updateOne(
    { guildId, key },
    { $set: { guildId, key, text, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
  return mmMacros().findOne({ guildId, key });
}
export async function removeMacro(guildId: string, key: string) {
  await mmMacros().deleteOne({ guildId, key });
}
export async function getMacro(guildId: string, key: string) {
  return mmMacros().findOne({ guildId, key });
}
export async function listMacros(guildId: string) {
  return mmMacros().find({ guildId }).sort({ key: 1 }).toArray();
}
