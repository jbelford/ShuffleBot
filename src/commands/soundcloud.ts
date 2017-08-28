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

  bot.on('sc.list', co.wrap(function* (message: Message) {
    const users: SCUser[] = yield scUsers.listUsers(message.guild.id);
    if (users.length === 0) return message.reply("There are no known SoundCloud users for this server!");
    const embed = Embeds.soundCloudUsersEmbed(message.guild, users);
    message.channel.send({ embed: embed });
  }));

  bot.on('sc.add', co.wrap(function* (message: Message, params: string[]) {
    if (params.length === 0) 
      return message.reply('Missing parameters: <user_permalink>');
    
    let progressMsg: Message = null;
    let lastProgress = 0;
    const timestamp = Date.now();

    scUsers.once(`start ${timestamp}`, co.wrap(function* (user_info) {
      yield message.reply(`Adding profile of ${user_info.full_name}`);
      progressMsg = yield message.channel.send(`Downloading favorites: 0%`);
    }));

    scUsers.on(`progress ${timestamp}`, co.wrap(function* (progress) {
      if (_.isNil(progressMsg) || lastProgress >= progress) return;
      lastProgress = progress;
      yield progressMsg.edit(`Downloading favorites: ${progress}%`);
    }));

    scUsers.once(`complete ${timestamp}`, co.wrap(function* (user_info, doc) {
      for (let i = 0; i < 10 && _.isNil(progressMsg); i++)
        yield Utils.sleep(20);
      if (!_.isNil(progressMsg)) yield progressMsg.edit(`Downloading favorites: 100%`);
      yield message.reply(`Finished ${doc.matchedCount ? "updating" : "adding"} music list for the profile: ${user_info.username}`);
    }));

    const err: string = yield scUsers.addUser(params[0], timestamp, message.guild.id);
    if (err) {
      yield message.reply("Failed to find that user's info!");
      scUsers.removeAllListeners(`start ${timestamp}`);
      scUsers.removeAllListeners(`complete ${timestamp}`);
      console.log(err);
    }
    scUsers.removeAllListeners(`progress ${timestamp}`);
  }));
}
