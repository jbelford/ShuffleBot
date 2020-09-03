"use strict"

import { Message, TextChannel } from 'discord.js';
import * as _ from 'lodash';
import * as Embeds from '../libs/common/Embeds';
import { DiscordBot } from '../libs/DiscordBot';
import { BotConfig, Daos, PollOption } from '../typings';


export function addGeneralCommands(bot: DiscordBot, config: BotConfig, daos: Daos) {
  const helpEmbed = Embeds.commandCategoriesEmbed(config.commands, config.commandToken);

  const commands: { [x: string]: (message: Message, params: string[], level: number) => Promise<any> } = {

    'help': async (message: Message, params: string[], level: number) => {
      if (params.length === 0) return await message.channel.send({ embed: helpEmbed });
      let idx = parseInt(params[0]);
      if (isNaN(idx)) {
        const arg = params[0].replace(config.commandToken, '').trim().toLowerCase();
        let cmdModule = config.commands.find(cmd => cmd.name.toLowerCase() === arg || cmd.prefix === arg);
        if (!_.isNil(cmdModule))
          return await message.channel.send({ embed: Embeds.commandListEmbed(cmdModule, config.commandToken, level) });

        let cmdSplit = arg.split('.');
        if (cmdSplit.length === 1) cmdSplit = ["", cmdSplit[0]];
        cmdModule = config.commands.find(cmd => cmd.prefix === cmdSplit[0]);
        if (_.isNil(cmdModule))
          return await message.reply(`There is no category with the prefix \`${cmdSplit[0]}\``);

        const command = cmdModule.commands[cmdSplit[1]];
        if (_.isNil(command) || level < command.level) return await message.reply(`The category \`${cmdModule.name}\` has no command \`${cmdSplit[1]}\``);
        const prefix = cmdModule.prefix.length > 0 ? `${cmdModule.prefix}.` : "";
        return await message.channel.send({ embed: Embeds.commandDetailsEmbed(cmdSplit[1], prefix, command, config.commandToken) });
      } else if (--idx >= 0 && idx < config.commands.length) {
        return await message.channel.send({ embed: Embeds.commandListEmbed(config.commands[idx], config.commandToken, level) });
      }
      return await message.reply(`There is no corresponding category for that number!`);
    },

    'invite': async (message: Message) => {
      if (!config.invite) return await message.reply('Sorry but I am not accepting invites right now. Try again later!');
      const inviteLink = await bot.client.generateInvite(bot.perms);
      await message.channel.send({ embed: Embeds.inviteEmbed(inviteLink, bot.client.user) });
    },

    'poll': async (message: Message, params: string[]) => {
      const pollMatch = /^\s*"([^"]+)"\s*\[([^\[\]]+(;[^\[\]]+)+)\]\s*$/g
      const match = pollMatch.exec(params.join(' '));
      if (_.isNil(match)) {
        return await message.reply(`Incorrect usage! The format is: ${config.commandToken}poll "Question" [Choice one; Choice two;...]`);
      }
      let randomKey = Math.floor(Math.random() * config.emojis.length);
      const question = match[1];
      const choices: PollOption[] = match[2].split(";").map(choice => {
        return { text: choice.trim(), emoji: config.emojis[randomKey++ % config.emojis.length] };
      });
      if (choices.length > 20) return await message.reply('Polls are limited to 20 options!');
      const success = await daos.pollManager.createPoll(message.channel as TextChannel, message.author, question, choices);
      if (!success) await message.reply("You already have a poll active!");
      else await message.delete();
    },

    'disableinvite': async (message: Message) => {
      if (!config.invite) return await message.author.send('Invite already disabled');
      config.invite = false;
      await message.channel.send('Invites have been disabled');
    },

    'enableinvite': async (message: Message) => {
      if (config.invite) return await message.author.send('Invite already enabled');
      config.invite = true;
      await message.channel.send('Invites have been enabled');
    },

    'servers': async (message: Message, params: string[]) => {
      const perPage = 15;
      const totalPages = Math.ceil(bot.client.guilds.size / perPage);
      let page = 0;
      if (params.length > 0) {
        page = Math.min(totalPages - 1, Math.max(0, parseInt(params[0]) || 0));
      }
      const startIdx = perPage * page;
      const text = bot.client.guilds.array()
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(startIdx, startIdx + perPage)
        .map(guild => `Name: ${guild.name} ~ Members: ${guild.memberCount} ~ ID: ${guild.id}`)
        .join('\n');
      await message.channel.send('```\nServers: ' + `${bot.client.guilds.size}, Page: ${page + 1}/${totalPages}\n${text}` + '\n```', { split: true });
    },

    'leave': async (message: Message, params: string[]) => {
      if (params.length === 0) return await message.reply('Missing arguments: <guildId>');
      const guild = bot.client.guilds.get(params[0]);
      if (_.isNil(guild)) return await message.reply(`Not a member of any guild with ID: \`${params[0]}\``);
      await guild.leave();
      await message.reply(`I have left the guild \`${guild.name}\``);
    },

    'musiclimit': async (message: Message, params: string[]) => {
      if (params.length > 0) {
        let idx = parseInt(params[0]);
        if (!isNaN(idx) && idx >= 0) {
          config.music.limit = idx;
          return await message.channel.send(`I have set the maximum number of allowed voice connections to \`${idx}\``);
        }
      }
      return await message.channel.send(`The current limit for voice connections is \`${config.music.limit}\``);
    },

    'musicstop': async (message: Message) => {
      daos.queuePlayerManager.leaveAll();
      await message.channel.send(`I have stopped all music streams.`);
    },

    'reset': async (message: Message) => {
      await message.reply('Shutting down...');
      process.exit(1);
    },

    'eval': async (message: Message, params: string[]) => {
      try {
        eval(params.join(' '));
      } catch (e) {
        await message.reply(`An error occured: ${e}`);
      }
    },

    'status': async (message: Message, params: string[]) => {
      if (params.length === 0) return await message.reply('Missing arguments: <status>');
      await bot.client.user.setGame(params.join(' '));
    }
  }

  bot.on(config.commands.find(cat => cat.name === 'General').prefix, (command: string, message: Message, params: string[], level: number) => {
    commands[command](message, params, level);
  });
}
