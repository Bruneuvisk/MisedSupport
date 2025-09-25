import {
SlashCommandBuilder,
ChatInputCommandInteraction,
Client,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
EmbedBuilder,
} from "discord.js";
import { Db } from "mongodb";
import { Mongo } from "../db/Mongo.js"; // ajuste o caminho se necessário
import { PontoService } from "../services/PontoService.js";
import { msToHMS } from "../utils/time.js";

export default {
data: new SlashCommandBuilder()
.setName("baterponto")
.setDescription("Abrir/fechar ponto e ver status.")
.addSubcommand((s) => s.setName("open").setDescription("Abrir ponto (mostrar botões)."))
.addSubcommand((s) => s.setName("close").setDescription("Fechar ponto atual."))
.addSubcommand((s) => s.setName("status").setDescription("Ver status da sua sessão."))
.toJSON(),


async execute({ interaction, client }: { interaction: ChatInputCommandInteraction; client: Client; db?: Db }) {
        const service = new PontoService(Mongo.getDb());
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!; const userId = interaction.user.id;


        if (sub === "open") {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ponto:open").setLabel("Abrir").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("ponto:close").setLabel("Fechar").setStyle(ButtonStyle.Danger),
        );
        await interaction.reply({ content: "Use os botões para **Abrir/Fechar** seu ponto.", components: [row], ephemeral: true });
        return;
        }


        if (sub === "close") {
        const res = await service.closeSession(guildId, userId);
        if (!res) return void interaction.reply({ ephemeral: true, content: "⚠️ Você não tem sessão aberta." });
        await interaction.reply({ ephemeral: true, content: `🕒 Tempo creditado: **${msToHMS(res.totalMs)}**.` });
        return;
        }


        if (sub === "status") {
        const st = await service.sessionStatus(guildId, userId);
        if (!st.opened) return void interaction.reply({ ephemeral: true, content: "Você **não** tem sessão aberta." });
        const emb = new EmbedBuilder()
        .setColor(0xe01e01)
        .setTitle("Seu status de ponto")
        .addFields(
        { name: "Desde", value: `<t:${Math.floor(new Date(st.openedAt!).getTime()/1000)}:f>`, inline: true },
        { name: "Acumulado", value: msToHMS(st.accMs!), inline: true },
        { name: "Categoria válida?", value: st.lastInRightCategory ? "Sim" : "Não", inline: true },
        { name: "Desmutado?", value: st.lastIsUnmuted ? "Sim" : "Não", inline: true },
        );
        await interaction.reply({ ephemeral: true, embeds: [emb] });
    }
  }
} 
