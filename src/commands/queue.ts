"use strict"

import * as co    from 'co';
import * as _     from 'lodash';
import * as Utils from '../libs/common/Utils';

import { BotConfig, Daos, SCUser, Track } from '../typings';
import { SoundCloudUsers } from '../models/SoundCloudUsers';
import { DiscordBot }      from '../libs/DiscordBot';
import { YoutubeAPI }      from '../libs/api/YoutubeAPI';
import { SoundCloudAPI }   from '../libs/api/SoundCloudAPI';
import { Message, TextChannel } from 'discord.js';

export function addQueueCommands(bot: DiscordBot, config: BotConfig, daos: Daos) {
  const queuePlayerManager = daos.queuePlayerManager;
  const scUsers = daos.soundCloudUsers;
  const users = daos.users;
  const ytApi = new YoutubeAPI(config.tokens.youtube);
  const scApi = new SoundCloudAPI(config.tokens.soundcloud);

  const commands: { [x: string]: (message: Message, params: string[], level: number) => any } = {

    'show': co.wrap(function* (message: Message) {
      const resp = yield queuePlayerManager.get(message.guild.id).show(message);
      if (resp) message.reply(resp);
    }),

    'clear': (message: Message) => {
      const queuePlayer = queuePlayerManager.get(message.guild.id);
      if (queuePlayer.queuedTracks === 0) return message.reply('The queue is already empty though...');
      queuePlayer.clear();
      message.reply('I have cleared the queue');
    },

    'shuffle': co.wrap(function* (message: Message) {
      const resp = yield queuePlayerManager.get(message.guild.id).shuffle();
      message.reply(resp ? resp : 'Successfully shuffled the queue');
    }),

    'add': co.wrap(function* (message: Message, params: string[]) {
      try {
        if (params.length === 0) return message.reply("You didn't specify what to add!");
        const playNext = params.includes('--next');
        const shuffle = params.includes('--shuffle');
        const paramsText = params.join(' ');
        let collected: Track[] = yield Utils.getUserList(message, paramsText, scUsers);
        collected = collected.concat(yield Utils.getYTList(message, paramsText, ytApi));
        collected = collected.concat(yield Utils.getSCList(message, paramsText, scApi));
        collected = collected.concat(yield Utils.getPlaylist(message, paramsText, users));
        if (collected.length === 0) {
          const query = paramsText.replace(/(^|\s)--(shuffle|next)($|\s)/g, '').trim();
          const songs: Track[] = yield ytApi.searchForVideo(query);
          const options = songs.map( (song, idx) => { 
            return { option: `${idx + 1}. ${song.title}`, select: [`${idx + 1}`] }
          });
          const songIdx: number = yield Utils.question(`Select which song you wanted to add:`, options,
            1000 * 60 * 5, message.author.id, message.channel as TextChannel);
          collected.push(songs[songIdx]);
        } else if (shuffle) {
          collected = Utils.shuffleList(collected);
        }
        yield queuePlayerManager.get(message.guild.id).enqueue(collected, playNext);
        const nameOrLength = collected.length > 1 ? `${collected.length} songs` : `**${collected[0].title}**`;
        let addedMsg = `Successfully added ${nameOrLength} `;
        addedMsg += playNext ? 'to be played next!' : 'to the queue!';
        message.reply(addedMsg);
      } catch (e) {
        message.reply(`Failed to add anything to the queue.`);
        console.log(e);
      }
    })
  }

  bot.on(config.commands.find(cat => cat.name === 'Queue').prefix, (command: string, message: Message, params: string[], level: number) => {
    const player = queuePlayerManager.get(message.guild.id);
    if (player.channel && player.channel.id !== message.channel.id)
      return message.reply(`My music channel has been locked in for \`#${player.channel.name}\`. Try again over there!`);
    commands[command](message, params, level);
  });
}
