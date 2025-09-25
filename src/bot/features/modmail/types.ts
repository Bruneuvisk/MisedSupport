export type TicketStatus = "open" | "closed";

export interface ModMailConfig {
  guildId: string;
  inboxCategoryId?: string | null;   // categoria onde os tickets (canais) serão criados
  logChannelId?: string | null;      // canal para logs/transcrições
  staffRoleIds: string[];            // cargos que podem ver/moderar tickets
  autoThread: boolean;               // (opcional) não usado no básico, mas já previsto
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketDoc {
  _id?: import("mongodb").ObjectId;
  guildId: string;
  userId: string;
  channelId: string;          // canal do ticket no servidor
  status: TicketStatus;
  createdAt: Date;
  closedAt?: Date | null;
  closedBy?: string | null;   // staffId
}

export interface MailMessage {
  _id?: import("mongodb").ObjectId;
  guildId: string;
  ticketId: import("mongodb").ObjectId;
  from: "user" | "staff" | "system";
  authorId: string;           // userId/staffId/botId
  content?: string;
  attachments?: {
    name: string;
    url: string;
    contentType?: string | null;
    size?: number | null;
  }[];
  createdAt: Date;
}

export interface MacroDoc {
  _id?: import("mongodb").ObjectId;
  guildId: string;
  key: string;       // ex: "saudacao"
  text: string;      // conteúdo da resposta rápida
  createdAt: Date;
  updatedAt: Date;
}
