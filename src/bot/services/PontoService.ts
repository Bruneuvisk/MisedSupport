// src/ponto/service/PontoService.ts
import { Db } from "mongodb";
import type { TextBasedChannel } from "discord.js";
import {
  colPontoConfig,
  colPontoSession,
  colPontoTotal,
  type PontoConfigDoc,
} from "../db/model.js";
import { getDayOfYear } from "../utils/time.js";

/**
 * PontoService — cache de config (30s), logs opcionais e subjanela robusta
 */
export class PontoService {
  private cfgCache = new Map<string, { exp: number; cfg: PontoConfigDoc }>();

  /**
   * @param db instância do MongoDB
   * @param getLogChannel (opcional) resolve um canal de texto por id (para logs)
   */
  constructor(
    private db: Db,
    private getLogChannel?: (id: string) => TextBasedChannel | null
  ) {}

  // =====================
  // Configuração (cache)
  // =====================
  private putCfgCache(guildId: string, cfg: PontoConfigDoc) {
    this.cfgCache.set(guildId, { exp: Date.now() + 30_000, cfg }); // 30s
  }
  private tryGetCfgFromCache(guildId: string): PontoConfigDoc | null {
    const hit = this.cfgCache.get(guildId);
    if (!hit) return null;
    if (Date.now() > hit.exp) {
      this.cfgCache.delete(guildId);
      return null;
    }
    return hit.cfg;
  }

  async getConfig(guildId: string): Promise<PontoConfigDoc> {
    const cached = this.tryGetCfgFromCache(guildId);
    if (cached) return cached;
    const c = await colPontoConfig(this.db).findOne({ guildId });
    const cfg: PontoConfigDoc =
      c ?? {
        guildId,
        roleId: null,
        voiceCategoryId: null,
        logChannelId: null,
        countOnlyUnmuted: true,
      };
    this.putCfgCache(guildId, cfg);
    return cfg;
  }

  async setConfig(guildId: string, patch: Partial<PontoConfigDoc>) {
    await colPontoConfig(this.db).updateOne(
      { guildId },
      { $set: { guildId, ...patch } },
      { upsert: true }
    );
    this.cfgCache.delete(guildId); // invalida cache
  }

  // ==============
  // Sessão de ponto
  // ==============
  async openSession(guildId: string, userId: string) {
    const existing = await colPontoSession(this.db).findOne({ guildId, userId });
    if (existing) return existing;

    const now = new Date();
    await colPontoSession(this.db).insertOne({
      guildId,
      userId,
      openedAt: now,
      accMs: 0,
      tickingStartedAt: null,
      lastVoiceChannelId: null,
      lastInRightCategory: false,
      lastIsUnmuted: false,
    });

    await this.log(
      guildId,
      `🟢 **Abertura** de ponto: <@${userId}> em <t:${Math.floor(
        now.getTime() / 1000
      )}:f>.`
    );

    return await colPontoSession(this.db).findOne({ guildId, userId });
  }

  async closeSession(guildId: string, userId: string) {
    const s = await colPontoSession(this.db).findOne({ guildId, userId });
    if (!s) return null;

    // fecha subjanela se estava contando
    let acc = s.accMs;
    if (s.tickingStartedAt)
      acc += Date.now() - new Date(s.tickingStartedAt).getTime();

    const openedAt = s.openedAt;
    const closedAt = new Date();

    await colPontoTotal(this.db).insertOne({
      guildId,
      userId,
      year: closedAt.getFullYear(),
      month: closedAt.getMonth() + 1,
      dayOfYear: getDayOfYear(closedAt),
      totalMs: acc,
      openedAt,
      closedAt,
    });

    await colPontoSession(this.db).deleteOne({ guildId, userId });

    await this.log(
      guildId,
      `🔴 **Fechamento** de ponto: <@${userId}> — crédito **${this.msToHMS(
        acc
      )}**.`
    );

    return { totalMs: acc, openedAt, closedAt };
  }

  /**
   * Atualiza a sessão ativa conforme o estado de voz.
   * Abre subjanela quando passa a valer; fecha e soma quando deixa de valer.
   */
  async handleVoiceState(
    guildId: string,
    userId: string,
    voiceChannelId: string | null,
    isInRightCategory: boolean,
    isUnmuted: boolean
  ) {
    const s = await colPontoSession(this.db).findOne({ guildId, userId });
    if (!s) return; // sem sessão aberta

    const cfg = await this.getConfig(guildId);
    const shouldTick =
      isInRightCategory && (isUnmuted || !cfg.countOnlyUnmuted);

    // calcula novo acumulado e decide nova tickingStartedAt
    let acc = s.accMs;
    let newTickStart: Date | null = s.tickingStartedAt
      ? new Date(s.tickingStartedAt)
      : null;

    if (shouldTick) {
      if (!newTickStart) newTickStart = new Date(); // começa a contar
    } else if (newTickStart) {
      acc += Date.now() - newTickStart.getTime(); // para de contar
      newTickStart = null;
    }

    await colPontoSession(this.db).updateOne(
      { guildId, userId },
      {
        $set: {
          accMs: acc,
          tickingStartedAt: newTickStart,
          lastVoiceChannelId: voiceChannelId,
          lastInRightCategory: isInRightCategory,
          lastIsUnmuted: isUnmuted,
        },
      }
    );
  }

  // ===== Status =====
  async sessionStatus(guildId: string, userId: string) {
    const s = await colPontoSession(this.db).findOne({ guildId, userId });
    if (!s) return { opened: false } as const;

    let acc = s.accMs;
    if (s.tickingStartedAt)
      acc += Date.now() - new Date(s.tickingStartedAt).getTime();

    return {
      opened: true,
      openedAt: s.openedAt,
      accMs: acc,
      lastInRightCategory: s.lastInRightCategory,
      lastIsUnmuted: s.lastIsUnmuted,
    } as const;
  }

  // ===== Ranking =====
  async ranking(guildId: string, period: "day" | "month") {
    const now = new Date();
    const filter =
      period === "day"
        ? { guildId, dayOfYear: getDayOfYear(now), year: now.getFullYear() }
        : { guildId, month: now.getMonth() + 1, year: now.getFullYear() };

    return await colPontoTotal(this.db)
      .aggregate<{ _id: string; sumMs: number }>([
        { $match: filter },
        { $group: { _id: "$userId", sumMs: { $sum: "$totalMs" } } },
        { $sort: { sumMs: -1 } },
        { $limit: 25 },
      ])
      .toArray();
  }

  // =====================
  // Utilitários internos
  // =====================
  private msToHMS(ms: number): string {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(ss)}`;
  }

  private async log(guildId: string, msg: string) {
        try {
            if (!this.getLogChannel) return;
            const cfg = await this.getConfig(guildId);
            if (!cfg.logChannelId) return;

            const ch = this.getLogChannel(cfg.logChannelId);
            if (ch && "send" in ch) {
            await (ch as any).send({ content: msg });
            }
        } catch (e) {
            console.warn("[PontoService:log]", e);
        }
    }
}
