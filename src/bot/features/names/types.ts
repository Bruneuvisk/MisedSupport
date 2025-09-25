export type NameCategory = "4c" | "3c" | "real" | "social" | "mixed";

export interface NameCategoryConfig {
  guildId: string;
  category: NameCategory;
  channelId?: string | null;        // canal onde avisar
  mentionRoleIds: string[];         // cargos p/ mencionar ao avisar
  enabled: boolean;
  updatedAt: Date;
}

export interface NameFoundEvent {
  guildId: string;
  category: NameCategory;
  username: string;
  source?: string;                   // opcional: onde achou
  extra?: string;                    // observações
  time?: Date;
}
