// src/bot/core/Bot.ts
import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';



export interface SlashCommand {
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute: (ctx: { client: MisedBot; interaction: any }) => Promise<void>;
}

export class MisedBot extends Client {
  public commands = new Collection<string, SlashCommand>();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessagePolls,
        GatewayIntentBits.AutoModerationConfiguration,
        GatewayIntentBits.GuildMessagePolls,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.AutoModerationExecution,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildInvites
      ],
      partials: [Partials.Channel],
    });
  }

  async start(token: string) {
    await this.loadCommands();
    await this.loadEvents();
    await this.login(token);
  }

  private getDirs() {
    // Em runtime (dist), este arquivo vira .../dist/bot/core/Bot.js
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const base = path.resolve(__dirname, '..'); // .../dist/bot
    const cmdDir = path.join(base, 'commands');
    const evtDir = path.join(base, 'events');
    return { cmdDir, evtDir };
  }

  private async loadCommands() {
    const { cmdDir } = this.getDirs();

    if (!fs.existsSync(cmdDir)) {
      console.warn('[SYNC] Pasta de comandos não encontrada:', cmdDir);
      return;
    }

    // Em produção (dist) só existem .js; em dev com tsx também funciona.
    const files = fs
      .readdirSync(cmdDir)
      .filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));

    const json: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

    for (const file of files) {
      const full = path.join(cmdDir, file);
      // ⚠️ Converter caminho Windows para file:// URL
      const mod = await import(pathToFileURL(full).href);
      const command: SlashCommand = mod.default;
      if (!command?.data?.name || typeof command.execute !== 'function') {
        console.warn(`[SYNC] Ignorando comando inválido: ${file}`);
        continue;
      }
      this.commands.set(command.data.name, command);
      json.push(command.data);
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

    try {
      const appId = process.env.APPLICATION_ID;
      if (appId) {
        await rest.put(Routes.applicationCommands(appId), { body: json });
      } else {
        const me: any = await rest.get(Routes.currentApplication());
        await rest.put(Routes.applicationCommands(me.id), { body: json });
      }
      console.log(`[SYNC] ${json.length} slash command(s) sincronizados GLOBALMENTE.`);
    } catch (e) {
      console.error('Falha ao sincronizar comandos', e);
    }
  }

  private async loadEvents() {
    const { evtDir } = this.getDirs();

    if (!fs.existsSync(evtDir)) {
      console.warn('[LOAD] Pasta de eventos não encontrada:', evtDir);
      return;
    }

    const files = fs
      .readdirSync(evtDir)
      .filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));

    for (const file of files) {
      const full = path.join(evtDir, file);
      const mod = await import(pathToFileURL(full).href);
      if (typeof mod.default === 'function') {
        // passa o MisedBot (this), não Client puro
        mod.default(this);
      }
    }
  }
}


