import { Events } from 'discord.js';
import { MisedBot } from '../core/Bot.js';
import onDM from "./modmail.dm.js";
import onStaff from "./modmail.staffRelay.js";

export default (client: MisedBot) => {

  client.on(Events.MessageCreate, async (message) => {
        if (message.channel.isDMBased()) return onDM(client);
        return onStaff(client);
  });
};
