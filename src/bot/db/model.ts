import { Collection, Db } from "mongodb";


export interface PontoConfigDoc {
    guildId: string;
    roleId?: string | null;
    voiceCategoryId?: string | null;
    logChannelId?: string | null;
    countOnlyUnmuted: boolean;
}


export interface PontoSessionDoc {
    guildId: string;
    userId: string;
    openedAt: Date;
    accMs: number;
    tickingStartedAt?: Date | null;
    lastVoiceChannelId?: string | null;
    lastInRightCategory: boolean;
    lastIsUnmuted: boolean;
}


export interface PontoTotalDoc {
    guildId: string;
    userId: string;
    year: number; // 2025
    month: number; // 1..12
    dayOfYear: number; // 1..366
    totalMs: number;
    openedAt: Date;
    closedAt: Date;
}


export function colPontoConfig(db: Db): Collection<PontoConfigDoc> {
return db.collection<PontoConfigDoc>("ponto_config");
}
export function colPontoSession(db: Db): Collection<PontoSessionDoc> {
return db.collection<PontoSessionDoc>("ponto_sessions");
}
export function colPontoTotal(db: Db): Collection<PontoTotalDoc> {
return db.collection<PontoTotalDoc>("ponto_totals");
}