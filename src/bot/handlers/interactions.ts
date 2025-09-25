import { Client, ButtonStyle, ActionRowBuilder, ButtonBuilder } from "discord.js";
import { Db } from "mongodb";
import { PontoService } from "../services/PontoService.js";


export function registerPontoButtons(client: Client, db: Db) {
const service = new PontoService(db);

client.on("interactionCreate", async (i) => {
    if (!i.isButton()) return;
    const customId = i.customId; if (!customId.startsWith("ponto:")) return;
    const [, action] = customId.split(":");


    if (action === "open") {
        await service.openSession(i.guildId!, i.user.id);
        await i.reply({ ephemeral: true, content: "✅ Ponto **aberto**. Fique na categoria configurada para contar." });
        return;
    }
    if (action === "close") {
        const res = await service.closeSession(i.guildId!, i.user.id);
        if (!res) return void i.reply({ ephemeral: true, content: "⚠️ Você não tem sessão aberta." });
        await i.reply({ ephemeral: true, content: `🕒 Ponto **fechado**. Tempo creditado: **${Math.round(res.totalMs/1000)}s**.` });
    }
});
}