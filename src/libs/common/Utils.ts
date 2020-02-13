import { EmojiIdentifierResolvable, Message, TextChannel } from 'discord.js';
import * as fs from 'fs';
import * as _ from 'lodash';
import request from 'request';
import { SoundCloudUsers } from '../../models/SoundCloudUsers';
import { Users } from '../../models/Users';
import { BotConfig, GuildUser, SCUser, Track } from '../../typings';
import { SoundCloudAPI } from '../api/SoundCloudAPI';
import { YoutubeAPI } from '../api/YoutubeAPI';


export function loadConfig(): BotConfig {
  const config = JSON.parse(fs.readFileSync(`./config/config.json`, 'utf8'));
  config.commands = JSON.parse(fs.readFileSync(`./config/commands.json`, 'utf8'));
  config.emojis = JSON.parse(fs.readFileSync(`./config/emojis.json`, 'utf8'));
  config.playlistInfo = fs.readFileSync(`./src/views/playlistInfo.html`, 'utf8');
  return config;
}

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

export async function reactSequential(message: Message, emojis: EmojiIdentifierResolvable[]) {
  for (const i in emojis) await message.react(emojis[i]);
}

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
    const msgText = options.reduce((a, b) => `${a}\n${b.option}`, `${text}\n\`\`\``) + '\n\n0. Cancel```';
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

async function getUserList(message: Message, params: string, scUsers: SoundCloudUsers) {
  const userQueries = parseUser(params);
  let songs: Track[] = [];
  let errors = false;
  for (const i in userQueries) {
    const query = userQueries[i];
    const user: SCUser = await scUsers.getUser(query[0]);
    if (_.isNil(user)) {
      await message.channel.send(`The user ${query[0]} isn't recognized.`);
      errors = true;
      continue;
    }
    await message.channel.send(`Adding ${user.username}'s tracks... Done`);
    if (query[1].toLowerCase() === "all") {
      songs = songs.concat(user.list);
      continue;
    }
    const range = query[1].split(',').map( x => parseInt(x) );
    if (range.some( x => isNaN(x) )) {
      await message.channel.send(`The query for user ${user.username} isn't valid.`);
      errors = true;
    } else if (range.length > 1) {
      songs = songs.concat(user.list.slice(range[0], range[1] === 0 ? user.list.length : range[1]));
    } else {
      const list = range[0] < 0 ? user.list.slice(range[0]) : user.list.slice(0, range[0]);
      songs = songs.concat(list);
    }
  }
  return { errors: errors, songs: songs };
}

async function getPlaylist(message: Message, params: string, users: Users) {
  const plReg = /(^|\s)pl\.([^\s]+)($|\s)/g;
  const plQueries: string[] = [];
  let match: string[];
  while (!_.isNil(match = plReg.exec(params))) {
    plQueries.push(match[2]);
  }
  let errors = false;
  let songs: Track[] = [];
  for (const i in plQueries) {
    const plId = plQueries[i];
    const user: GuildUser = await users.getUserFromPlaylistId(plId);
    if (_.isNil(user)) {
      await message.channel.send(`The playlist \`${plId}\` isn't recognized.`);
      errors = true;
      continue;
    }
    const playlist = user.playlists.find(x => x.key === plId);
    await message.channel.send(`Adding tracks from playlist \`${playlist.name}\`... Done`);
    songs = songs.concat(playlist.list);
  }
  return { errors: errors, songs: songs };
}

async function getYTList(message: Message, params: string, ytApi: YoutubeAPI) {
  let errors = false;
  const ytQuery = ytApi.parseUrl(params);
  if (!_.isNil(ytQuery)) {
    const notify: Message = await message.channel.send('Retrieving songs from YouTube url...') as Message;
      try {
        const videos: Track[] = await ytApi.getVideos();
        await notify.edit(`${notify.content} Done`);
        return { errors: errors, songs: videos };
      } catch (e) {
        await notify.edit(`${notify.content} Failed. ${e}`);
        errors = true;
      }
  }
  return { errors: errors, songs: [] };
}

async function getSCList(message: Message, params: string, scApi: SoundCloudAPI) {
  let errors = false;
  const scQuery = scApi.parseUrl(params);
  if (!_.isNil(scQuery)) {
    const notify: Message = await message.channel.send('Retrieving songs from SoundCloud url...') as Message;
    try {
      const tracks: Track[] = await scApi.getTracks();
      await notify.edit(`${notify.content} Done`);
      return { errors: errors, songs: tracks };
    } catch (e) {
      await notify.edit(`${notify.content} Failed. ${e}`);
      errors = true;
    }
  }
  return { errors: errors, songs: [] };
}

export async function songQuery(message: Message, paramsText: string, scUsers: SoundCloudUsers, users: Users, scApi: SoundCloudAPI, ytApi: YoutubeAPI) {
  const playNext = paramsText.includes('--next');
  const shuffle = paramsText.includes('--shuffle');
  let collected = [
    await getUserList(message, paramsText, scUsers),
    await getYTList(message, paramsText, ytApi),
    await getSCList(message, paramsText, scApi),
    await getPlaylist(message, paramsText, users)
  ].reduce((a, b) => ({ errors: a.errors || b.errors, songs: a.songs.concat(b.songs) }));
  if (collected.errors) return null;
  else if (collected.songs.length === 0) {
    const query = paramsText.replace(/(^|\s)--(shuffle|next)($|\s)/g, '').trim();
    const songs: Track[] = await ytApi.searchForVideo(query);
    const options = songs.map( (song, idx) => {
      return { option: `${idx + 1}. ${song.title}`, select: [`${idx + 1}`] }
    });
    const songIdx = await question(`Select which song you wanted to add:`, options,
      1000 * 60 * 5, message.author.id, message.channel as TextChannel);
    if (songIdx < 0) {
      await message.reply(songIdx === -1 ? 'Cancelled query.' : 'Invalid selection. Cancelling query.');
      return null;
    }
    collected.songs.push(songs[songIdx]);
  } else if (shuffle) {
    collected.songs = shuffleList(collected.songs);
  }
  return { songs: collected.songs, nextFlag: playNext, shuffleFlag: shuffle };
}
