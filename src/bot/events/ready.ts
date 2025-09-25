import { Events, ChatInputCommandInteraction } from 'discord.js';
import { MisedBot } from '../core/Bot.js';
import { startBackupScheduler } from "../utils/scheduler.js";
import { ensurePontoIndexes } from '../db/indexes.js';
import { Mongo } from '../db/Mongo.js';

export default (client: MisedBot) => {
  client.once(Events.ClientReady, (c) => {
    console.log(`[READY] Logado como ${c.user.tag} (id=${c.user.id})`);
    startBackupScheduler(client);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await ensurePontoIndexes(Mongo.getDb());
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;

    try {
      await cmd.execute({ client, interaction: interaction as ChatInputCommandInteraction });
    } catch (err) {
      console.error(err);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'Ocorreu um erro ao executar o comando.', ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: 'Ocorreu um erro ao executar o comando.', ephemeral: true }).catch(() => {});
      }
    }
  });
};
