"use strict"

import * as co     from 'co';
import * as _      from 'lodash';
import * as Utils  from '../libs/common/Utils';
import * as Embeds from '../libs/common/Embeds';

import { BotConfig, GuildUser, Daos, Playlists, Playlist, Track } from '../typings';
import { DiscordBot }           from '../libs/DiscordBot';
import { YoutubeAPI }           from '../libs/api/YoutubeAPI';
import { SoundCloudAPI }        from '../libs/api/SoundCloudAPI';
import { Message, TextChannel, Attachment } from 'discord.js';
import { Readable } from 'stream';

export function addPlaylistCommands(bot: DiscordBot, config: BotConfig, daos: Daos) {
  const users = daos.users;
  const scUsers = daos.soundCloudUsers;
  const ytApi = new YoutubeAPI(config.tokens.youtube);
  const scApi = new SoundCloudAPI(config.tokens.soundcloud);

  const commands: { [x: string]: (message: Message, params: string[], level: number) => any } = {

    'list': co.wrap(function* (message: Message, params: string[], level: number) {
      if (params.length === 0 || isNaN(parseInt(params[0])))
        return message.channel.send({ embed: Embeds.playlistCategoriesEmbed(message.guild.name, config.commandToken) });
      const idx = parseInt(params[0]);
      if (idx === 1) {
        const botUser: GuildUser = yield users.getUser(bot.client.user.id);
        if (botUser.playlists.num === 0) return message.channel.send(`**I am still working on those! ;)**`);
        return message.channel.send({ embed: Embeds.userPlaylistsEmbed(bot.client.user, botUser.playlists, false) });
      } else if (idx === 2) {
        const members = message.guild.members.array().map( member => member.id );
        const playlistUsers: GuildUser[] = yield users.getList(members);
        const playlists = playlistUsers.reduce((a, b) => {
          a.num += b.playlists.num;
          _.forEach(b.playlists.list, (playlist, key) => {
            a.list[key] = playlist;
            a.list[key].owner = message.guild.members.get(b.userId).displayName;
          })
          return a;
        }, { num: 0, list: {} });
        if (playlists.num === 0) return message.channel.send('**No one on this server has playlists yet!**');
        return message.channel.send({ embed: Embeds.guildPlaylistsEmbed(message.guild, playlists) });
      } else if (idx === 3) {
        const guildUser: GuildUser = yield users.getUser(message.author.id);
        if (guildUser.playlists.num === 0)
          return message.reply(`You don't have any playlists yet! Check out \`${config.commandToken}help pl.new\` to get started!`);
        return message.channel.send({ embed: Embeds.userPlaylistsEmbed(message.author, guildUser.playlists, true) });
      }
      message.reply('Nothing corresponds to that index!');
    }),
    
    'new': co.wrap(function* (message: Message, params: string[], level: number) {
      const paramsReg = /^\s*([^\s]+)\s+"([^"]+)"\s*$/g
      const match = paramsReg.exec(params.join(' '));
      if (_.isNil(match))
        return message.reply(`Incorrect usage! The format is: \`${config.commandToken}pl.new <playlistId> "<name>"\``);

      const plId = match[1];
      if (plId.length > 7) return message.reply(`Playlist ID exceeds maximum character length of \`7\`!`)
      const name = match[2].trim().replace(/\s+/g, ' ');
      if (name.length > 25) return message.reply(`Name exceeds maximum character length of \`25\`!`);
      const err = yield users.newPlaylist(message.author.id, plId, name);
      if (err) message.reply(err);
      else message.reply(`The playlist **${name}** has been created and can be identified using \`${plId}\``);
    }),

    'add': co.wrap(function* (message: Message, params: string[], level: number) {
      const paramsReg = /^\s*([^\s]+)\s+-\s+(.+)\s*/g
      const match = paramsReg.exec(params.join(' '));
      if (_.isNil(match))
        return message.reply(`Incorrect usage! The format is: \`${config.commandToken}pl.add <playlistId> - (<query> | <specific>)\``);
      
      const plId = match[1];
      const paramsText = match[2];
      let collected: Track[] = yield Utils.getUserList(message, paramsText, scUsers);
      collected = collected.concat(yield Utils.getYTList(message, paramsText, ytApi));
      collected = collected.concat(yield Utils.getSCList(message, paramsText, scApi));
      collected = collected.concat(yield Utils.getPlaylist(message, paramsText, users));
      if (collected.length === 0) {
        const songs: Track[] = yield ytApi.searchForVideo(paramsText);
        const options = songs.map( (song, idx) => {
          return { option: `${idx + 1}. ${song.title}`, select: [`${idx + 1}`] };
        });
        try {
          const songIdx: number = yield Utils.question(`Select which song you wanted to add:`, options,
            1000 * 60 * 5, message.author.id, message.channel as TextChannel);
          collected.push(songs[songIdx]);
        } catch (e) {
          return message.reply(e);
        }
      }

      const err = yield users.addToPlaylist(message.author.id, plId, collected);
      if (err) return message.reply(err);

      const nameOrLength = collected.length > 1 ? `${collected.length} songs` : `**${collected[0].title}**`;
      let addedMsg = `Successfully added ${nameOrLength} to the playlist!`;
      message.reply(addedMsg);
    }),

    'remove': co.wrap(function* (message: Message, params: string[], level: number) {
      const paramsReg = /^\s*([^\s]+)\s+\[\s*(-?\d+(\s*,\s*-?\d+)?|ALL)\s*]\s*$/gi;
      const match = paramsReg.exec(params.join(' '));
      if (_.isNil(match))
        return message.reply(`Incorrect usage! The format is \`${config.commandToken}pl.remove <playlistId> <range>\``);
      
      const plId = match[1];
      const range = match[2];
      let err: string;
      if (range.toLowerCase() === "all") {
        err = yield users.removeFromPlaylist(message.author.id, plId, 0, 0);
      } else {
        const numberRange = range.split(',').map(x => parseInt(x));
        if (numberRange[0] === 0) return message.reply(`First number in the range can not be zero!`);
        err = numberRange.length === 2 ? yield users.removeFromPlaylist(message.author.id, plId, --numberRange[0], numberRange[1]) :
          yield users.removeFromPlaylist(message.author.id, plId, --numberRange[0]);
      }

      if (err) return message.reply(err);
      message.reply("I have removed those songs from the playlist!");
    }),

    'delete': co.wrap(function* (message: Message, params: string[], level: number) {
      if (params.length === 0) return message.reply('Missing parameters: <playlistId>');
      const err = yield users.deletePlaylist(message.author.id, params[0]);
      if (err) return message.reply(err);
      message.reply(`Your playlist identified by \`${params[0]}\` has been successfully removed.`);
    }),

    'info': co.wrap(function* (message: Message, params: string[], level: number) {
      if (params.length === 0) return message.reply('Missing parameter: <playlistId>');
      const user: GuildUser = yield users.getUserFromPlaylistId(params[0]);
      if (_.isNil(user)) return message.reply('That playlist does not exist!');

      const playlist = user.playlists.list[params[0]];
      let playlistInfo = config.playlistInfo;
      playlistInfo = playlistInfo.replace(/%TITLE%/g, playlist.name);
      playlistInfo = playlistInfo.replace(/%DETAIL%/g, `Owner: ${bot.client.users.get(user.userId).username} ~ Songs: ${playlist.size} ~ ID: ${params[0]}`);
      playlistInfo = playlistInfo.replace(/'%SONGS%'/g, JSON.stringify(playlist.list));

      const readable = new Readable();
      readable._read = () => {};
      readable.push(playlistInfo);
      readable.push(null);

      const attachment = new Attachment(readable, `${playlist.name}.html`);
      message.channel.send('Here ya go!', attachment);
    })
  }

  bot.on(config.commands.find(cat => cat.name === 'Playlist').prefix, (command: string, message: Message, params: string[], level: number) => {
    commands[command](message, params, level);
  });
}