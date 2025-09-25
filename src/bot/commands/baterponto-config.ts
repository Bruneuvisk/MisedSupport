import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    Client,
    PermissionFlagsBits,
    roleMention,
    channelMention,
} from "discord.js";
import { Db } from "mongodb";
import { Mongo } from "../db/Mongo.js"; // ajuste o caminho se necessário
import { PontoService } from "../services/PontoService.js";


export default {
data: new SlashCommandBuilder()
.setName("baterponto-config")
.setDescription("Configurar o sistema de ponto no servidor.")
.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
.addSubcommand((s) =>
s
.setName("setrole")
.setDescription("Define o cargo que pode bater ponto (opcional).")
.addRoleOption((o) => o.setName("cargo").setDescription("Cargo permitido").setRequired(false))
)
.addSubcommand((s) =>
s
.setName("setcategory")
.setDescription("Define a categoria de voz válida para contagem.")
.addChannelOption((o) =>
o.setName("categoria").setDescription("Categoria de voz").addChannelTypes(4).setRequired(true)
)
)
.addSubcommand((s) =>
s
.setName("setlog")
.setDescription("Define o canal de logs.")
.addChannelOption((o) => o.setName("canal").setDescription("Canal de logs").setRequired(true))
)
.addSubcommand((s) => s.setName("toggleunmuted").setDescription("Alterna entre contar só desmutado ou contar sempre."))
.toJSON(),


async execute({ interaction, client }: { interaction: ChatInputCommandInteraction; client: Client; db?: Db }) {
        const service = new PontoService(Mongo.getDb());
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;


        if (sub === "setrole") {
        const role = interaction.options.getRole("cargo");
        await service.setConfig(guildId, { roleId: role?.id ?? null });
        await interaction.reply({ ephemeral: true, content: role ? `✅ Cargo permitido: ${roleMention(role.id)}` : "✅ Cargo removido (qualquer um pode)." });
        return;
        }
        if (sub === "setcategory") {
        const cat = interaction.options.getChannel("categoria", true);
        await service.setConfig(guildId, { voiceCategoryId: cat.id });
        await interaction.reply({ ephemeral: true, content: `✅ Categoria de voz: ${channelMention(cat.id)}` });
        return;
        }
        if (sub === "setlog") {
        const ch = interaction.options.getChannel("canal", true);
        await service.setConfig(guildId, { logChannelId: ch.id });
        await interaction.reply({ ephemeral: true, content: `✅ Canal de logs: ${channelMention(ch.id)}` });
        return;
        }
        if (sub === "toggleunmuted") {
        const cfg = await service.getConfig(guildId);
        await service.setConfig(guildId, { countOnlyUnmuted: !cfg.countOnlyUnmuted });
        await interaction.reply({ ephemeral: true, content: `✅ Agora: **${!cfg.countOnlyUnmuted ? "conta só desmutado" : "conta mesmo mutado"}**.` });
        return;
        }
    }
}