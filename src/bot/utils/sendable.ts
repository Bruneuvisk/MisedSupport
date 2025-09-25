// src/bot/utils/sendable.ts
import {
  Channel,
  ChannelType,
  DMChannel,
  NewsChannel,
  PublicThreadChannel,
  PrivateThreadChannel,
  TextChannel,
} from 'discord.js';

export type SendableChannel =
  | TextChannel
  | NewsChannel
  | PublicThreadChannel
  | PrivateThreadChannel
  | DMChannel;

export function toSendableChannel(ch: Channel | null | undefined): SendableChannel | null {
  if (!ch) return null;

  switch (ch.type) {
    case ChannelType.GuildText:
      return ch as TextChannel;
    case ChannelType.GuildAnnouncement:
      return ch as NewsChannel;
    case ChannelType.PublicThread:
      return ch as PublicThreadChannel;
    case ChannelType.PrivateThread:
      return ch as PrivateThreadChannel;
    case ChannelType.DM:
      return ch as DMChannel;
    default:
      return null;
  }
}
