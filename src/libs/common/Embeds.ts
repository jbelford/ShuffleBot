import * as _ from 'lodash';

import { Queue } from '../data/Queue';
import { CommandsList, Track, SCUser }         from '../../typings';
import { RichEmbedOptions, ClientUser, Guild } from 'discord.js';

export function helpEmbed(commands: CommandsList, cmdTok: string) {
  const embed: RichEmbedOptions = {
    title : `Syntax:`,
    description : '<>   =>  Argument\n{}    =>  Optional\n()     =>  Group\n|       =>  Or\n&     =>  And\n&|    =>  And/Or\n+      =>  One or many of these',
    color : 0x5A54B8,
    author : {
      name : "Command List",
      icon_url : "http://www.omgubuntu.co.uk/wp-content/uploads/2016/09/terminal-icon.png"
    },
    fields : []
  };
  const addCommands = (cmd, key) => {
    const field = {
      name: `${cmdTok}${key}`,
      value: cmd.detail.join('')
    };
    if (!_.isNil(cmd.args)) field.name += ` ${cmd.args}`;
    embed.fields.push(field);
  }
  _.forEach(commands.everyone, addCommands);
  embed.fields.push({ name: 'ADMIN ONLY', value: 'The following are admin only commands' });
  _.forEach(commands.admin, addCommands);
  embed.fields.push({ name : 'For more info check out Github', value : 'https://github.com/jbelford/DiscordMusicBot' });
  return embed;
}

export function inviteEmbed(inviteLink: string, user: ClientUser): RichEmbedOptions {
  return {
    title: `**Invite ${user.username}**`,
    description: 'Click this to invite bot to server',
    url: inviteLink,
    color: 0x7985f0,
    thumbnail: { 
      url: user.avatarURL,
      height: 500,
      width: 500
    }
  };
}

export function soundCloudUsersEmbed(guild: Guild, users: SCUser[]) {
  const embed: RichEmbedOptions = {
    author: {
      name: `SoundCloud Users: ${guild.name}`,
      icon_url: guild.iconURL
    },
    description: "List of SoundCloud users known by this guild",
    color: 0xff7700,
    fields: []
  };
  _.forEach(users, (user, key) => {
    embed.fields.push({
      name: `${key + 1}:\t${user.username}`,
      value: `|--> Permalink: ${user.permalink}\n|--> Songs: ${user.favorites}` 
    });
  });
  return embed;
}

export function songEmbed(playing: Track, paused: boolean, next?: Track) {
  const embed: RichEmbedOptions = {
    title : `**${playing.title}**`,
    description : `**${playing.poster}**`,
    color : playing.src === "sc" ? 0xff7700 : 0xbb0000,
    image : { url : playing.pic },
    thumbnail : {
      url : playing.src === "sc" ? 'https://www.drupal.org/files/project-images/soundcloud-logo.png' :
            'https://images.vexels.com/media/users/3/137425/isolated/preview/f2ea1ded4d037633f687ee389a571086-youtube-icon-logo-by-vexels.png'
    },
    author : {
      name : paused ? "Paused" : "Now Playing",
      icon_url : paused ? 'http://icons.iconarchive.com/icons/graphicloads/100-flat/128/pause-icon.png' :
                  'http://wearabletechnologysmartwatches.space/Videos/wp-content/uploads/2015/12/favicon.png'
    }
  }
  if (next) {
    embed.footer = {
      text : `Up next: ${next.title}`,
      icon_url : next.pic
    }
  }
  return embed;
}

export function queueEmbed(queue: Queue<Track>) {
  const queueEmbed: RichEmbedOptions = {
    color : 0x1B9857,
    description : '',
    author : {
      name : "Queue",
      icon_url : "https://cdn0.iconfinder.com/data/icons/audio-visual-material-design-icons/512/queue-music-512.png"
    }
  }
  queue.get(10).forEach((song, idx) => {
    queueEmbed.description += `${idx + 1}:\t**${song.title}**\n`;
  });
  if (queue.size() - 10 > 0)
    queueEmbed.footer = { text : `Plus ${queue.size() - 10} other songs` };
  return queueEmbed;
}
