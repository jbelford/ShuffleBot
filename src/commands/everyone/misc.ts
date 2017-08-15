"use strict"

import * as co     from 'co';
import * as fs     from 'fs';
import * as Embeds from '../../libs/common/Embeds';

import { DiscordBot } from '../../libs/DiscordBot';
import { BotConfig }  from '../../typings';
import { Message }    from 'discord.js';

export function addMiscCommands(bot: DiscordBot, config: BotConfig) {
  const helpEmbed = Embeds.helpEmbed(config.commands, config.commandToken);

  bot.on('help', (message: Message) => {
    message.channel.send({ embed : helpEmbed })
      .catch(console.log);
  });

  bot.on('invite', co.wrap(function* (message: Message) {
    const inviteLink = yield bot.client.generateInvite(bot.perms);
    message.channel.send({ embed: Embeds.inviteEmbed(inviteLink, bot.client.user) });
  }));
}
