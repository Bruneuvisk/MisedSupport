import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import {
  hexToRgb,
  rgbToHex,
  rgbToDecimal,
  decimalToRgb,
} from "../utils/colors.js";

export default {
  data: new SlashCommandBuilder()
    .setName("corinfo")
    .setDescription("Mostra detalhes sobre uma cor")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    // /corinfo rgb
    .addSubcommand(sc =>
      sc
        .setName("rgb")
        .setDescription("Mostra detalhes sobre uma cor em formato RGB")
        .addIntegerOption(o => o.setName("r").setDescription("Vermelho (0-255)").setMinValue(0).setMaxValue(255).setRequired(true))
        .addIntegerOption(o => o.setName("g").setDescription("Verde (0-255)").setMinValue(0).setMaxValue(255).setRequired(true))
        .addIntegerOption(o => o.setName("b").setDescription("Azul (0-255)").setMinValue(0).setMaxValue(255).setRequired(true))
    )
    // /corinfo hex
    .addSubcommand(sc =>
      sc
        .setName("hex")
        .setDescription("Mostra detalhes sobre uma cor em formato hexadecimal")
        .addStringOption(o =>
          o.setName("valor").setDescription("Ex.: #e31b3d ou e31b3d").setRequired(true)
        )
    )
    // /corinfo decimal
    .addSubcommand(sc =>
      sc
        .setName("decimal")
        .setDescription("Mostra detalhes sobre uma cor em formato decimal")
        .addIntegerOption(o =>
          o.setName("valor").setDescription("Número decimal da cor").setRequired(true).setMinValue(0).setMaxValue(16777215)
        )
    )
    .toJSON(),

  async execute({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) {
  if (!interaction.isChatInputCommand()) return;
    const sub = interaction.options.getSubcommand();

    try {
      let r = 0, g = 0, b = 0; // <- já inicializa, evita erro

      if (sub === "rgb") {
        r = interaction.options.getInteger("r", true);
        g = interaction.options.getInteger("g", true);
        b = interaction.options.getInteger("b", true);
      }

      if (sub === "hex") {
        const hex = interaction.options.getString("valor", true);
        ({ r, g, b } = hexToRgb(hex));
      }

      if (sub === "decimal") {
        const dec = interaction.options.getInteger("valor", true);
        ({ r, g, b } = decimalToRgb(dec));
      }

      const hex = rgbToHex(r, g, b);
      const dec = rgbToDecimal(r, g, b);

      const embed = new EmbedBuilder()
        .setTitle("🎨 Informação da Cor")
        .setColor(dec)
        .addFields(
          { name: "RGB", value: `\`${r}, ${g}, ${b}\``, inline: true },
          { name: "Hex", value: `\`${hex}\``, inline: true },
          { name: "Decimal", value: `\`${dec}\``, inline: true },
        )
        .setThumbnail(`https://singlecolorimage.com/get/${hex.replace("#", "")}/128x128`);

      await interaction.reply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.reply({ content: `❌ Erro: ${err.message ?? err}`, ephemeral: true });
    }
  },
};
