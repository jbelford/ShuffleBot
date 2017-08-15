"use strict"

import * as co from 'co';
import { DiscordBot } from '../../libs/DiscordBot';
import { Message }    from 'discord.js';

export function addOwnerMiscCommands(bot: DiscordBot) {

  bot.on('reset', co.wrap(function* (message: Message) {
    yield message.reply('Shutting down...');
    process.exit(1);
  }));

  bot.on('eval', co.wrap(function* (message: Message, params: string[]) {
    try {
      eval(params.join(' '));
    } catch (e) {
      yield message.reply(`An error occured: ${e}`);
    }
  }));
}
