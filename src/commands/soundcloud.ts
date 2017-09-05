"use strict"

import * as co     from 'co';
import * as _      from 'lodash';
import * as Utils  from '../libs/common/Utils';
import * as Embeds from '../libs/common/Embeds';

import { SoundCloudUsers }         from '../models/SoundCloudUsers';
import { DiscordBot }              from '../libs/DiscordBot';
import { BotConfig, Daos, SCUser } from '../typings';
import { Message }                 from 'discord.js';

export function addSoundCloudCommands(bot: DiscordBot, config: BotConfig, daos: Daos) {
  const scUsers = daos.soundCloudUsers;
  const guilds = daos.guilds;

  const commands: { [x: string]: (message: Message, params: string[], level: number) => any } = {

    'list': co.wrap(function* (message: Message) {
      const users: SCUser[] = yield scUsers.listUsers(message.guild.id);
      if (users.length === 0) return message.reply("There are no known SoundCloud users for this server!");
      const embed = Embeds.soundCloudUsersEmbed(message.guild, users);
      message.channel.send({ embed: embed });
    }),

    'add': co.wrap(function* (message: Message, params: string[], level: number) {
      if (params.length === 0) 
        return message.reply('Missing parameters: <user_permalink>');
  
      if (level < 3) {
        const canDl = yield guilds.canDownload(message.guild.id);
        if (!canDl) return message.reply(`This server has already reached the limit for adding users at the moment. Try again in ${config.sc.interval} hours.`);
        guilds.updateDownload(message.guild.id);
      }
  
      let progressMsg: Message = null;
      let isDeleted = false;
      let lastProgress = 0;
      const timestamp = Date.now();
  
      scUsers.once(`start ${timestamp}`, co.wrap(function* (user_info) {
        yield message.reply(`Adding profile of ${user_info.username}`);
        progressMsg = yield message.channel.send(`Downloading favorites: 0%`);
      }));
  
      scUsers.on(`progress ${timestamp}`, function (progress) {
        if (_.isNil(progressMsg) || lastProgress >= progress) return;
        lastProgress = progress;
        progressMsg.edit(`Downloading favorites: ${progress}%`).catch(e => {
          message.author.send(`My message was deleted while updating. I'll let you know when it's done.`);
          isDeleted = true;
          scUsers.removeAllListeners(`progress ${timestamp}`);
        });
      });
  
      scUsers.once(`complete ${timestamp}`, co.wrap(function* (user_info, doc) {
        for (let i = 0; i < 10 && _.isNil(progressMsg) && !isDeleted; i++)
          yield Utils.sleep(20);
        const msg = `Finished ${doc.matchedCount ? 'updating' : 'adding'} music list for the profile: ${user_info.username}`;
        if (isDeleted) return message.author.send(msg);
        if (!_.isNil(progressMsg)) yield progressMsg.edit(`Downloading favorites: 100%`);
        yield message.reply(msg);
      }));
  
      const err: string = yield scUsers.addUser(params[0], timestamp, message.guild.id);
      if (err) {
        yield message.reply("Failed to find that user's info!");
        scUsers.removeAllListeners(`start ${timestamp}`);
        scUsers.removeAllListeners(`complete ${timestamp}`);
        console.log(err);
      }
      scUsers.removeAllListeners(`progress ${timestamp}`);
    }),

    'remove': co.wrap(function* (message: Message, params: string[]) {
      if (params.length === 0) 
        return message.reply('Missing parameters: <user_permalink>');
      
      const success = yield scUsers.removeUser(params[0], message.guild.id);
      if (success) yield message.reply('The SoundCloud user entry has been removed from this server.');
      else yield message.reply('That SoundCloud user is not valid!');
    })
    
  };

  bot.on(config.commands.find(cat => cat.name === 'SoundCloud').prefix, (command: string, message: Message, params: string[], level: number) => {
    commands[command](message, params, level);
  });
}
