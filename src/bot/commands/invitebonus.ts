import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
} from "discord.js";
import { InvitesDao } from "../db/InvitesDao.js";

export default {
  data: new SlashCommandBuilder()
    .setName("invitebonus")
    .setDescription("Gerencia bônus de convites.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sc => sc.setName("add")
      .setDescription("Adicionar bônus")
      .addUserOption(o => o.setName("user").setDescription("Usuário").setRequired(true))
      .addIntegerOption(o => o.setName("qtd").setDescription("Quantidade").setRequired(true).setMinValue(1)))
    .addSubcommand(sc => sc.setName("remove")
      .setDescription("Remover bônus")
      .addUserOption(o => o.setName("user").setDescription("Usuário").setRequired(true))
      .addIntegerOption(o => o.setName("qtd").setDescription("Quantidade").setRequired(true).setMinValue(1)))
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.isChatInputCommand()) return;
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild!;
    const user = interaction.options.getUser("user", true);
    const qtd  = interaction.options.getInteger("qtd", true);

    await InvitesDao.incBonus(guild.id, user.id, sub === "add" ? qtd : -qtd);
    await interaction.reply(`✅ Bônus ${sub === "add" ? "adicionado" : "removido"}: \`${user.tag}\` (${qtd}).`);
  },
};
