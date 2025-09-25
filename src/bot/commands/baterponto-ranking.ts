import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, userMention } from "discord.js";
import { Db } from "mongodb";
import { Mongo } from "../db/Mongo.js"; // ajuste o caminho se necessário
import { PontoService } from "../services/PontoService.js";
import { msToHMS } from "../utils/time.js";


export default {
data: new SlashCommandBuilder()
.setName("baterponto-ranking")
.setDescription("Ranking de horas contabilizadas")
.addStringOption((o) =>
o
.setName("periodo")
.setDescription("Escolha o período")
.setRequired(true)
.addChoices({ name: "dia", value: "day" }, { name: "mês", value: "month" })
)
.toJSON(),


async execute({ interaction, client }: { interaction: ChatInputCommandInteraction; client: Client; db?: Db }) {
        const period = interaction.options.getString("periodo", true) as "day" | "month";
        const service = new PontoService(Mongo.getDb());
        const guildId = interaction.guildId!;


        const top = await service.ranking(guildId, period);
        if (!top.length) return void interaction.reply({ ephemeral: true, content: "Sem dados para o período." });


        const lines = top.map((r, idx) => `${idx + 1}. ${userMention(r._id)} — **${msToHMS(r.sumMs)}**`);
        const emb = new EmbedBuilder().setColor(0xe01e01).setTitle(`Ranking (${period === "day" ? "Hoje" : "Este mês"})`).setDescription(lines.join("\n"));
        await interaction.reply({ embeds: [emb] });
    }
}
