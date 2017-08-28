"use strict"

import * as co     from 'co';
import * as fs     from 'fs';
import * as _      from 'lodash';
import * as Embeds from '../libs/common/Embeds';

import { BotConfig, PollOption, Daos }  from '../typings';
import { DiscordBot } from '../libs/DiscordBot';
import { Message, TextChannel }    from 'discord.js';

export function addGeneralCommands(bot: DiscordBot, config: BotConfig, daos: Daos) {
  const helpEmbed = Embeds.commandCategoriesEmbed(config.commands, config.commandToken);
  const commands = config.commands;
  const cmdTok = config.commandToken;
  const emojis = config.emojis;
  const pollManager = daos.pollManager;

  bot.on('help', (message: Message, params: string[]) => {
    if (params.length === 0) return message.channel.send({ embed: helpEmbed });
    let idx = parseInt(params[0]);
    if (isNaN(idx)) {
      const arg = params[0].replace(cmdTok, '').trim().toLowerCase();
      let cmdModule = commands.find( cmd => cmd.name.toLowerCase() === arg || cmd.prefix === arg);
      if (!_.isNil(cmdModule)) 
        return message.channel.send({ embed: Embeds.commandListEmbed(cmdModule, cmdTok) });

      let cmdSplit = arg.split('.');
      if (cmdSplit.length === 1) cmdSplit = ["", cmdSplit[0]];
      cmdModule = commands.find( cmd => cmd.prefix === cmdSplit[0]);
      if (_.isNil(cmdModule)) 
        return message.reply(`There is no category with the prefix \`${cmdSplit[0]}\``);

      const command = cmdModule.commands[cmdSplit[1]];
      if (_.isNil(command)) return message.reply(`The category \`${cmdModule.name}\` has no command \`${cmdSplit[1]}\``);
      const prefix = cmdModule.prefix.length > 0 ? `${cmdModule.prefix}.` : "";
      return message.channel.send({ embed: Embeds.commandDetailsEmbed(cmdSplit[1], prefix, command, cmdTok) });
    } else if (--idx >= 0 && idx < commands.length) {
      return message.channel.send({ embed: Embeds.commandListEmbed(commands[idx], cmdTok) });
    }
    return message.reply(`There is no corresponding category for that number!`);
  });

  bot.on('invite', co.wrap(function* (message: Message) {
    const inviteLink = yield bot.client.generateInvite(bot.perms);
    message.channel.send({ embed: Embeds.inviteEmbed(inviteLink, bot.client.user) });
  }));

  bot.on('poll', co.wrap(function* (message: Message, params: string[]) {
    const pollMatch = /^\s*"([^"]+)"\s*\[([^\[\]]+(;[^\[\]]+)+)\]\s*$/g
    const match = pollMatch.exec(params.join(' '));
    if (_.isNil(match)) {
      return message.reply(`Incorrect usage! The format is: ${cmdTok}poll "Question" [Choice one; Choice two;...]`);
    }
    let randomKey = Math.floor(Math.random() * emojis.length);
    const question = match[1];
    const choices: PollOption[] = match[2].split(";").map(choice => {
      return { text: choice.trim(), emoji: emojis[randomKey++ % emojis.length] };
    });
    if (choices.length > 20) return message.reply('Polls are limited to 20 options!');
    const success = pollManager.createPoll(message.channel as TextChannel, message.author, question, choices);
    if (!success) message.reply("You already have a poll active!");
    else message.delete(); 
  }));

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
