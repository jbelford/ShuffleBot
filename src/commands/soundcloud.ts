"use strict"

import * as _      from 'lodash';
import * as Utils  from '../libs/common/Utils';
import * as Embeds from '../libs/common/Embeds';

import { DiscordBot }              from '../libs/DiscordBot';
import { BotConfig, Daos } from '../typings';
import { Message }                 from 'discord.js';

export function addSoundCloudCommands(bot: DiscordBot, config: BotConfig, daos: Daos) {
  const scUsers = daos.soundCloudUsers;
  const guilds = daos.guilds;

  const commands: { [x: string]: (message: Message, params: string[], level: number) => any } = {

    'list': async (message: Message) => {
      const users = await scUsers.listUsers(message.guild.id);
      if (users.length === 0) return await message.reply("There are no known SoundCloud users for this server!");
      const embed = Embeds.soundCloudUsersEmbed(message.guild, users);
      await message.channel.send({ embed: embed });
    },

    'add': async (message: Message, params: string[], level: number) => {
      if (params.length === 0) 
        return await message.reply('Missing parameters: <user_permalink>');
  
      if (level < 3) {
        const canDl = await guilds.canDownload(message.guild.id);
        if (!canDl) return await message.reply(`This server has already reached the limit for adding users at the moment. Try again in ${config.sc.interval} hours.`);
        await guilds.updateDownload(message.guild.id);
      }
  
      let progressMsg: Message = null;
      let isDeleted = false;
      let lastProgress = 0;
      const timestamp = Date.now();
  
      scUsers.once(`start ${timestamp}`, async (user_info) => {
        await message.reply(`Adding profile of ${user_info.username}`);
        progressMsg = await message.channel.send(`Downloading favorites: 0%`) as Message;
      });
  
      scUsers.on(`progress ${timestamp}`, async (progress) => {
        if (_.isNil(progressMsg) || lastProgress >= progress) return;
        lastProgress = progress;
        await progressMsg.edit(`Downloading favorites: ${progress}%`).catch(e => {
          message.author.send(`My message was deleted while updating. I'll let you know when it's done.`);
          isDeleted = true;
          scUsers.removeAllListeners(`progress ${timestamp}`);
        });
      });
  
      scUsers.once(`complete ${timestamp}`, async (user_info, doc) => {
        for (let i = 0; i < 10 && _.isNil(progressMsg) && !isDeleted; i++)
          await Utils.sleep(20);
        const msg = `Finished ${doc.matchedCount ? 'updating' : 'adding'} music list for the profile: ${user_info.username}`;
        if (isDeleted) return await message.author.send(msg);
        if (!_.isNil(progressMsg)) await progressMsg.edit(`Downloading favorites: 100%`);
        await message.reply(msg);
      });
  
      const err = await scUsers.addUser(params[0], timestamp, message.guild.id);
      if (err) {
        await message.reply("Failed to find that user's info!");
        scUsers.removeAllListeners(`start ${timestamp}`);
        scUsers.removeAllListeners(`complete ${timestamp}`);
        console.log(err);
      }
      scUsers.removeAllListeners(`progress ${timestamp}`);
    },

    'remove': async (message: Message, params: string[]) => {
      if (params.length === 0) 
        return await message.reply('Missing parameters: <user_permalink>');
      
      const success = await scUsers.removeUser(params[0], message.guild.id);
      await message.reply(success ? 'The SoundCloud user entry has been removed from this server.' : 'That SoundCloud user is not valid!');
    }
    
  };

  bot.on(config.commands.find(cat => cat.name === 'SoundCloud').prefix, (command: string, message: Message, params: string[], level: number) => {
    commands[command](message, params, level);
  });
}
