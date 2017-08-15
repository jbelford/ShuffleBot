"use strict"

import * as co    from 'co';
import * as _     from 'lodash';
import * as Utils from '../../libs/common/Utils';

import { BotConfig, Daos, SCUser, Track } from '../../typings';
import { SoundCloudUsers } from '../../models/SoundCloudUsers';
import { DiscordBot }      from '../../libs/DiscordBot';
import { YoutubeAPI }      from '../../libs/api/YoutubeAPI';
import { SoundCloudAPI }   from '../../libs/api/SoundCloudAPI';
import { Message }         from 'discord.js';

function parseUser(text: string) {
  const userQueries: string[][]= [];
  const dbReg = /(^|\s)([^\s]+)\s+\[\s*(-?\d+|-?\d+\s*,\s*-?\d+|ALL)\s*\]/gi;
  let match: string[];
  while (!_.isNil(match = dbReg.exec(text))) {
    userQueries.push(match.slice(2, 4));
  }
  return userQueries;
}

function* getUserList(message: Message, params: string, scUsers: SoundCloudUsers): IterableIterator<Track[]> {
  const userQueries = parseUser(params);
  let songs: Track[] = [];
  for (const i in userQueries) {
    const query = userQueries[i];
    const user: SCUser = yield scUsers.getUser(query[0]) as any;
    if (_.isNil(user)) {
      message.channel.send(`The user ${query[0]} isn't recognized.`);
      continue;
    }
    message.channel.send(`Adding ${user.permalink}'s tracks... Done`);
    if (query[1].toLowerCase() === "all") {
      songs = songs.concat(user.list);
      continue;
    }
    const range = query[1].split(',').map( x => parseInt(x) );
    if (range.filter( x => isNaN(x) ).length) {
      message.channel.send(`The query for user ${user.permalink} isn't valid.`);
    } else if (range.length > 1) {
      songs = songs.concat(user.list.slice(range[0], range[1]));
    } else {
      const list = range[0] < 0 ? user.list.slice(range[0]) : user.list.slice(0, range[0]);
      songs = songs.concat(list);
    }
  }
  return songs;
}

function* getYTList(message: Message, params: string, ytApi: YoutubeAPI) {
  const ytQuery = ytApi.parseUrl(params);
  if (!_.isNil(ytQuery)) {
    const notify: Message = yield message.channel.send('Retrieving songs from YouTube url...');
      try {
        const videos: Track[] = yield ytApi.getVideos();
        yield notify.edit(`${notify.content} Done`);
        return videos;
      } catch (e) {
        yield notify.edit(`${notify.content} Failed. ${e}`);
      }
  }
  return [] as Track[];
}

function* getSCList(message: Message, params: string, scApi: SoundCloudAPI) {
  const scQuery = scApi.parseUrl(params);
  if (!_.isNil(scQuery)) {
    const notify: Message = yield message.channel.send('Retrieving songs from SoundCloud url...');
    try {
      const tracks: Track[] = yield scApi.getTracks();
      yield notify.edit(`${notify.content} Done`);
      return tracks;
    } catch (e) {
      yield notify.edit(`${notify.content} Failed. ${e}`);
    }
  }
  return [] as Track[];
}

export function addQueueCommands(bot: DiscordBot, config: BotConfig, daos: Daos) {
  const queuePlayerManager = daos.queuePlayerManager;
  const scUsers = daos.soundCloudUsers;
  const ytApi = new YoutubeAPI(config.tokens.youtube);
  const scApi = new SoundCloudAPI(config.tokens.soundcloud);

  bot.on('queue', co.wrap(function* (message: Message) {
    const resp = yield queuePlayerManager.get(message.guild.id).show(message);
    if (resp) message.reply(resp);
  }));

  bot.on('clear', (message: Message) => {
    queuePlayerManager.get(message.guild.id).clear();
    message.reply('I have cleared the queue');
  });

  bot.on('shuffle', co.wrap(function* (message: Message) {
    const resp = yield queuePlayerManager.get(message.guild.id).shuffle();
    message.reply(resp ? resp : 'Successfully shuffled the queue');
  }));

  bot.on('add', co.wrap(function* (message: Message, params: string[]) {
    try {
      const playNext = params.includes('--next');
      const shuffle = params.includes('--shuffle');
      const paramsText = params.join(' ');
      let collected: Track[] = yield getUserList(message, paramsText, scUsers);
      collected = collected.concat(yield getYTList(message, paramsText, ytApi));
      collected = collected.concat(yield getSCList(message, paramsText, scApi));
      if (collected.length === 0) {
        const query = paramsText.replace(/(^|\s)--(shuffle|next)($|\s)/g, '').trim();
        collected.push(yield ytApi.searchForVideo(query));
      } else if (shuffle) {
        collected = Utils.shuffleList(collected);
      }
      yield queuePlayerManager.get(message.guild.id).enqueue(collected, playNext);
      let addedMsg = `Successfully added ${collected.length} songs `;
      addedMsg += playNext ? 'to be played next!' : 'to the queue!';
      message.reply(addedMsg);
    } catch (e) {
      message.reply(`Failed to add to queue`);
      console.log(e);
    }
  }));
}
