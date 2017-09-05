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

  const commands: { [x: string]: (message: Message, params: string[], level: number) => any} = {

    'help': (message: Message, params: string[], level: number) => {
      if (params.length === 0) return message.channel.send({ embed: helpEmbed });
      let idx = parseInt(params[0]);
      if (isNaN(idx)) {
        const arg = params[0].replace(config.commandToken, '').trim().toLowerCase();
        let cmdModule = config.commands.find( cmd => cmd.name.toLowerCase() === arg || cmd.prefix === arg);
        if (!_.isNil(cmdModule)) 
          return message.channel.send({ embed: Embeds.commandListEmbed(cmdModule, config.commandToken, level) });
  
        let cmdSplit = arg.split('.');
        if (cmdSplit.length === 1) cmdSplit = ["", cmdSplit[0]];
        cmdModule = config.commands.find( cmd => cmd.prefix === cmdSplit[0]);
        if (_.isNil(cmdModule)) 
          return message.reply(`There is no category with the prefix \`${cmdSplit[0]}\``);
  
        const command = cmdModule.commands[cmdSplit[1]];
        if (_.isNil(command) || level < command.level) return message.reply(`The category \`${cmdModule.name}\` has no command \`${cmdSplit[1]}\``);
        const prefix = cmdModule.prefix.length > 0 ? `${cmdModule.prefix}.` : "";
        return message.channel.send({ embed: Embeds.commandDetailsEmbed(cmdSplit[1], prefix, command, config.commandToken) });
      } else if (--idx >= 0 && idx < config.commands.length) {
        return message.channel.send({ embed: Embeds.commandListEmbed(config.commands[idx], config.commandToken, level) });
      }
      return message.reply(`There is no corresponding category for that number!`);
    },

    'invite': co.wrap(function* (message: Message) {
      if (!config.invite) return yield message.reply('Sorry but I am not accepting invites right now. Try again later!');
      const inviteLink = yield bot.client.generateInvite(bot.perms);
      message.channel.send({ embed: Embeds.inviteEmbed(inviteLink, bot.client.user) });
    }),

    'poll': co.wrap(function* (message: Message, params: string[]) {
      const pollMatch = /^\s*"([^"]+)"\s*\[([^\[\]]+(;[^\[\]]+)+)\]\s*$/g
      const match = pollMatch.exec(params.join(' '));
      if (_.isNil(match)) {
        return message.reply(`Incorrect usage! The format is: ${config.commandToken}poll "Question" [Choice one; Choice two;...]`);
      }
      let randomKey = Math.floor(Math.random() * config.emojis.length);
      const question = match[1];
      const choices: PollOption[] = match[2].split(";").map(choice => {
        return { text: choice.trim(), emoji: config.emojis[randomKey++ % config.emojis.length] };
      });
      if (choices.length > 20) return message.reply('Polls are limited to 20 options!');
      const success = daos.pollManager.createPoll(message.channel as TextChannel, message.author, question, choices);
      if (!success) message.reply("You already have a poll active!");
      else message.delete(); 
    }),

    'disableinvite': (message: Message) => {
      if (!config.invite) return message.author.send('Invite already disabled');
      config.invite = false;
      message.channel.send('Invites have been disabled');
    },

    'enableinvite': (message: Message) => {
      if (config.invite) return message.author.send('Invite already enabled');
      config.invite = true;
      message.channel.send('Invites have been enabled');
    },

    'servers': (message: Message, params: string[]) => {
      const guildsMapping = bot.client.guilds.map( guild => `Name: ${guild.name} ~ Members: ${guild.memberCount} ~ ID: ${guild.id}`);
      if (params.length > 0) {
        let idx = parseInt(params[0]);
        if (!isNaN(idx) && --idx > 0 && idx * 50 < guildsMapping.length)
          return message.channel.send('```' + guildsMapping.slice(idx * 50).join('\n') + '```', { split: true });
      }
      message.channel.send('```' + guildsMapping.slice(0, Math.min(50, guildsMapping.length)).join('\n') + '```', { split: true });
    },

    'leave': (message: Message, params: string[]) => {
      if (params.length === 0) return message.reply('Missing arguments: <guildId>');
      const guild = bot.client.guilds.get(params[0]);
      if (_.isNil(guild)) return message.reply(`Not a member of any guild with ID: \`${params[0]}\``);
      guild.leave();
      message.reply(`I have left the guild \`${guild.name}\``);
    },

    'musiclimit': (message: Message, params: string[]) => {
      if (params.length > 0) {
        let idx = parseInt(params[0]);
        if (!isNaN(idx) && idx >= 0) {
          config.music.limit = idx;
          return message.channel.send(`I have set the maximum number of allowed voice connections to \`${idx}\``);
        }
      }
      return message.channel.send(`The current limit for voice connections is \`${config.music.limit}\``);
    },

    'musicstop': (message: Message) => {
      daos.queuePlayerManager.leaveAll();
      message.channel.send(`I have stopped all music streams.`);
    },

    'reset': co.wrap(function* (message: Message) {
      yield message.reply('Shutting down...');
      process.exit(1);
    }),

    'eval': co.wrap(function* (message: Message, params: string[]) {
      try {
        eval(params.join(' '));
      } catch (e) {
        yield message.reply(`An error occured: ${e}`);
      }
    })
  }

  bot.on(config.commands.find(cat => cat.name === 'General').prefix, (command: string, message: Message, params: string[], level: number) => {
    commands[command](message, params, level);
  });
}
