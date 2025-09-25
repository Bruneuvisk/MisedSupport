import { Client, VoiceState } from "discord.js";
import { Db } from "mongodb";
import { PontoService } from "../services/PontoService.js";


export function registerVoiceStateHandler(client: Client, db: Db) {
    const service = new PontoService(db);
    client.on("voiceStateUpdate", async (oldS: VoiceState, newS: VoiceState) => {
            try {
                const guild = newS.guild ?? oldS.guild; if (!guild) return;
                const member = newS.member ?? oldS.member; if (!member) return;
                const channel = newS.channel ?? null;
                const voiceChannelId = channel?.id ?? null;
                const cfg = await service.getConfig(guild.id);
                const inRightCategory = !!(channel && cfg.voiceCategoryId && channel.parentId === cfg.voiceCategoryId);
                const isUnmuted = !newS.selfMute && !newS.serverMute;
                await service.handleVoiceState(guild.id, member.id, voiceChannelId, inRightCategory, isUnmuted);
            } catch (e) { console.error("[voiceStateUpdate]", e); }
    });
}