import { Mongo } from "../../db/Mongo.js";
import type { Collection } from "mongodb";
import type { ModMailConfig, TicketDoc, MailMessage, MacroDoc } from "./types.js";

export function mmConfigs(): Collection<ModMailConfig> {
  return Mongo.getDb().collection<ModMailConfig>("modmail_configs");
}
export function mmTickets(): Collection<TicketDoc> {
  return Mongo.getDb().collection<TicketDoc>("modmail_tickets");
}
export function mmMessages(): Collection<MailMessage> {
  return Mongo.getDb().collection<MailMessage>("modmail_messages");
}
export function mmMacros(): Collection<MacroDoc> {
  return Mongo.getDb().collection<MacroDoc>("modmail_macros");
}
