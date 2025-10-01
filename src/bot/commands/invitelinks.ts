import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("invitelinks")
    .setDescription("Lista os convites do usuário.")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addUserOption(o => o.setName("user").setDescription("Usuário (dono dos convites)").setRequired(false))
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
    if (!interaction.isChatInputCommand()) return;
    const guild = interaction.guild!;
    const user = interaction.options.getUser("user") ?? interaction.user;

    const invites = await guild.invites.fetch({ cache: false }).catch(() => null);
    if (!invites) return interaction.reply("❌ Não consegui buscar convites (preciso de `Gerenciar Servidor`).");

    const owned = invites.filter(i => i.inviterId === user.id);
    if (!owned.size) return interaction.reply(`${user.tag} não possui convites ativos.`);

    const lines = owned.map(i => `• \`${i.code}\` — usos: **${i.uses ?? 0}** ${i.maxUses ? `/ ${i.maxUses}` : ""}`).join("\n");
    await interaction.reply(lines);
  },
};
