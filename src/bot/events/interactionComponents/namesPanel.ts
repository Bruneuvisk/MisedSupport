import {
  type Client, type Interaction, EmbedBuilder, PermissionFlagsBits, ChannelType
} from "discord.js";
import { getCategoryConfig, setEnabled } from "../../features/names/repo.js";
import { CATEGORY_LABEL, makeCategoryActions } from "../../features/names/ui.js";
import type { NameCategory } from "../../features/names/types.js";

export default async function onInteraction(client: Client, i: Interaction) {
  if (!i.isAnySelectMenu() && !i.isButton()) return;
  if (!i.guild) return;

  // SELECT de categoria
  if (i.isStringSelectMenu() && i.customId === "names:select-category") {
    const cat = i.values[0] as NameCategory;
    const cfg = await getCategoryConfig(i.guild.id, cat);

    const info = new EmbedBuilder()
      .setTitle(`Categoria: ${CATEGORY_LABEL[cat]}`)
      .setDescription(
        `Canal: ${cfg?.channelId ? `<#${cfg.channelId}>` : "_não definido_"}\n` +
        `Mentions: ${cfg?.mentionRoleIds?.length ? cfg.mentionRoleIds.map(id => `<@&${id}>`).join(", ") : "_nenhum_"}\n` +
        `Status: **${cfg?.enabled ? "Ativado" : "Desativado"}**\n\n` +
        "Use os botões abaixo para alternar status, configurar mentions e canal (via `/names config`)."
      )
      .setColor(0x00ff66);

    return i.reply({ ephemeral: true, embeds: [info], components: [makeCategoryActions(cfg || undefined)] });
  }

  // Botão toggle rápido (exige perm de gerenciar servidor)
  if (i.isButton() && i.customId === "names:toggle") {
    if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return i.reply({ ephemeral: true, content: "Você precisa de **Gerenciar Servidor**." });
    }
    // Última categoria visualizada não é guardada aqui — para algo 100% stateful,
    // leve o cat no customId (ex: names:toggle|4c). Mantive simples:
    return i.reply({ ephemeral: true, content: "Use `/names config categoria:<...> enabled:<true/false>` para alternar." });
  }

  if (i.isButton() && (i.customId === "names:mentions" || i.customId === "names:setchannel")) {
    return i.reply({ ephemeral: true, content: "Use `/names config` para editar Mentions/Canal desta categoria." });
  }

  if (i.isButton() && i.customId === "names:test") {
    return i.reply({ ephemeral: true, content: "Use `/names notify` para testar um aviso nesta categoria." });
  }
}
