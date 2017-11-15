import * as co      from 'co';
import * as request from 'request';
import * as _       from 'lodash';

import { SoundCloudAPI }   from '../api/SoundCloudAPI';
import { YoutubeAPI }      from '../api/YoutubeAPI';
import { Track, SCUser, GuildUser }   from '../../typings';
import { Users }           from '../../models/Users';
import { SoundCloudUsers } from '../../models/SoundCloudUsers';
import { TextChannel, Message, EmojiIdentifierResolvable } from 'discord.js';

export function shuffleList<T>(list: T[]) {
  for (let i = 0; i < list.length; i++) {
    const rand = Math.floor(Math.random() * list.length);
    const temp = list[rand];
    list[rand] = list[i];
    list[i] = temp;
  }
  return list;
}

export function sleep(millis: number) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(true);
    }, millis);
  });
}

export const reactSequential: (message: Message, emojis: EmojiIdentifierResolvable[]) => Promise<{}> = 
    co.wrap(function* (message: Message, emojis: EmojiIdentifierResolvable[]) {
  for (const i in emojis) yield message.react(emojis[i]);
});

export function requestPromise(uri: string, options?: request.CoreOptions): Promise<request.RequestResponse> {
  return new Promise((resolve, reject) => {
    request(uri, options, (error: any, response: request.RequestResponse, body: any) => {
      if (error) return reject(error);
      return resolve(response);
    });
  });
}

export function question(text: string, options: { option: string, select: string[] }[], time: number, userId: string, channel: TextChannel): Promise<number> {
  return new Promise((resolve, reject) => {
    const msgText = options.reduce((a, b) => `${a}\n${b.option}`, `${text}\n\`\`\``) + '0. Cancel```';
    channel.send(msgText).then( (sent: Message) => {
      const collector = channel.createMessageCollector( (m: Message) => m.author.id === userId, { time: time });
      collector.on('collect', m => {
        const content = m.content.trim().toLowerCase().split(/\s+/g)[0];
        const idx = options.findIndex( (val) => val.select.includes(content));
        collector.stop();
        return resolve(idx);
      });
      collector.on('end', (collected, reason) => {
        if (reason === 'time') return reject();
      });
    });
  });
}

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
    message.channel.send(`Adding ${user.username}'s tracks... Done`);
    if (query[1].toLowerCase() === "all") {
      songs = songs.concat(user.list);
      continue;
    }
    const range = query[1].split(',').map( x => parseInt(x) );
    if (range.some( x => isNaN(x) )) {
      message.channel.send(`The query for user ${user.username} isn't valid.`);
    } else if (range.length > 1) {
      songs = songs.concat(user.list.slice(range[0], range[1] === 0 ? user.list.length : range[1]));
    } else {
      const list = range[0] < 0 ? user.list.slice(range[0]) : user.list.slice(0, range[0]);
      songs = songs.concat(list);
    }
  }
  return songs;
}

function* getPlaylist(message: Message, params: string, users: Users) {
  const plReg = /(^|\s)pl\.([^\s]+)($|\s)/g;
  const plQueries: string[] = [];
  let match: string[];
  while (!_.isNil(match = plReg.exec(params))) {
    plQueries.push(match[2]);
  }
  let songs: Track[] = [];
  for (const i in plQueries) {
    const plId = plQueries[i];
    const user: GuildUser = yield users.getUserFromPlaylistId(plId);
    if (_.isNil(user)) {
      message.channel.send(`The playlist \`${plId}\` isn't recognized.`);
      continue;
    }
    message.channel.send(`Adding tracks from playlist \`${user.playlists.list[plId].name}\`... Done`);
    songs = songs.concat(user.playlists.list[plId].list);
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

export function* songQuery(message: Message, paramsText: string, scUsers: SoundCloudUsers, users: Users, scApi: SoundCloudAPI, ytApi: YoutubeAPI) {
  const playNext = paramsText.includes('--next');
  const shuffle = paramsText.includes('--shuffle');
  let collected: Track[] = yield getUserList(message, paramsText, scUsers);
  collected = collected.concat(yield getYTList(message, paramsText, ytApi));
  collected = collected.concat(yield getSCList(message, paramsText, scApi));
  collected = collected.concat(yield getPlaylist(message, paramsText, users));
  if (collected.length === 0) {
    const query = paramsText.replace(/(^|\s)--(shuffle|next)($|\s)/g, '').trim();
    const songs: Track[] = yield ytApi.searchForVideo(query);
    const options = songs.map( (song, idx) => { 
      return { option: `${idx + 1}. ${song.title}`, select: [`${idx + 1}`] }
    });
    const songIdx: number = yield question(`Select which song you wanted to add:`, options,
      1000 * 60 * 5, message.author.id, message.channel as TextChannel);
    if (songIdx < 0) {
      message.reply('Invalid selection. Cancelling query.');
      return null;
    }
    collected.push(songs[songIdx]);
  } else if (shuffle) {
    collected = shuffleList(collected);
  }
  return { songs: collected, nextFlag: playNext, shuffleFlag: shuffle };
}
