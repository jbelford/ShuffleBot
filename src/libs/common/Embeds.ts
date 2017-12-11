import * as _ from 'lodash';

import { Queue } from '../data/Queue';
import { Command, CommandsList, Track, SCUser, PollOption, CommandModule, GuildUser, Playlist } from '../../typings';
import { RichEmbedOptions, ClientUser, Guild, Message, User } from 'discord.js';

export function commandCategoriesEmbed(cmdList: CommandsList, cmdTok: string): RichEmbedOptions {
  const embed = {
    color : 0x5A54B8,
    author : {
      name : "Command Category List",
      icon_url : "http://www.omgubuntu.co.uk/wp-content/uploads/2016/09/terminal-icon.png"
    },
    description: 'The following are categories for the various commands available:\n\n'
  };
  embed.description += cmdList.reduce((a, b, i) => a.concat(`${i + 1}. ${b.name}\n`), "```") + "```";
  embed.description += `\nUse \`${cmdTok}help help\` to see more details about using this command`
  return embed;
}

export function commandListEmbed(cmdModule: CommandModule, cmdTok: string, level: number) {
  const embed: RichEmbedOptions = {
    color : 0x5A54B8,
    author : {
      name : cmdModule.name,
      icon_url : "http://www.omgubuntu.co.uk/wp-content/uploads/2016/09/terminal-icon.png"
    },
    description: 'The following are commands for this category:\n\n```'
  };
  const prefix = cmdModule.prefix.length > 0 ? `${cmdModule.prefix}.` : "";
  _.forEach(cmdModule.commands, (cmd, name) => {
    if (level < cmd.level) return;
    embed.description += `${cmdTok}${prefix}${name}\n`
  });
  embed.description += '```';
  embed.description += `\nUse \`${cmdTok}help <command>\` to see more information for that command.`
  return embed;
}

export function commandDetailsEmbed(name: string, prefix: string, command: Command, cmdTok: string): RichEmbedOptions {
  const argsDesc = _.isNil(command.args) ? '' : command.args.description.map(x => `\t${x}`).join('').replace(/</g, '***<').replace(/>/g, '>***');
  const usage = command.usage.map(x => `${cmdTok}${prefix}${x}`).join('\n');
  return {
    author : {
      name: `${cmdTok}${prefix}${name}`,
      icon_url : "http://www.omgubuntu.co.uk/wp-content/uploads/2016/09/terminal-icon.png"
    },
    color : 0x5A54B8,
    description: `${command.detail}\n\n**Arguments**: ${_.isNil(command.args) ? 'None' : `${command.args.text}\n\n${argsDesc}`}` + 
      `\n\n**Usage**:\n\`\`\`${usage}\`\`\`\nConfused about syntax? Check out this wiki: https://github.com/jbelford/ShuffleBot/wiki/Command-Syntax`
  }
}

export function playlistCategoriesEmbed(serverName: string, cmdTok: string): RichEmbedOptions {
  return {
    color : 0xc6e20d,
    author : {
      name : `Playlist Categories`,
      icon_url : 'https://cdn0.iconfinder.com/data/icons/social-messaging-ui-color-shapes/128/list-circle-blue-512.png'
    },
    description : `The following are categories of playlists you can use:\n` +
      `\`\`\`\n1. ShuffleBot's Playlists\n2. ${serverName}'s Playlists\n3. My Playlists\n\`\`\`` +
      `\nUse \`${cmdTok}help pl.list\` to see more details about using this command`
  };
}

export function userPlaylistsEmbed(user: User, playlists: Playlist[], personal: boolean): RichEmbedOptions {
  const embed: RichEmbedOptions = {
    color: 0xc6e20d,
    author: {
      name: `${personal ? 'Your' : `${user.username}'s`} Playlists`,
      icon_url: user.avatarURL
    },
    description: '```'
  };
  let i = 1;
  _.forEach(playlists, playlist => {
    embed.description += `${i++}: ${playlist.name}\n\tID: ${playlist.key}\tSONGS: ${playlist.size}\n`;
  });
  embed.description += '```';
  return embed;
}

export function guildPlaylistsEmbed(guild: Guild, playlists: any[]): RichEmbedOptions {
  const embed: RichEmbedOptions = {
    color: 0xc6e20d,
    author: {
      name: `${guild.name}'s Playlists`,
      icon_url: guild.iconURL
    },
    description: 'This is the list of playlists from all the users across the server:\n```'
  };
  let i = 1;
  _.forEach(playlists, playlist => {
    embed.description += `${i++}: ${playlist.name}\n\tID: ${playlist.key}\tSONGS: ${playlist.size}\tOWNER: ${playlist.owner}\n\n`;
  });
  embed.description += '```';
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
      name: `SoundCloud Users`,
      icon_url: guild.iconURL
    },
    description: "Here are the SoundCloud users registered for this server.\n```",
    color: 0xff7700
  };
  _.forEach(users, (user, key) => {
    embed.description += `${key + 1}:  ${user.username}\n` +
      `\tPermalink: ${user.permalink}\n` +
      `\tSongs: ${user.favorites}\n\n`;
  });
  embed.description += '```';
  return embed;
}

export function pollEmbed(question: string, options: PollOption[], user: User): RichEmbedOptions {
  return {
    author: {
      name: question,
      icon_url: 'http://images.clipartpanda.com/help-clipart-11971487051948962354zeratul_Help.svg.med.png'
    },
    color: 0x46DBC0,
    description: options.reduce((o1: string, o2: PollOption) => `${o1}\n${o2.emoji}: ${o2.text}`, ''),
    footer: {
      icon_url: user.avatarURL,
      text: `${user.username}'s poll`
    }
  }
}

export function pollResultsEmbed(question: string, options: PollOption[], message: Message, user: User) {
  const embed: RichEmbedOptions = {
    author: {
      name: `Results: "${question}"`,
      icon_url: 'https://cdn0.iconfinder.com/data/icons/shift-free/32/Complete_Symbol-128.png'
    },
    color: 0x46DBC0,
    description: '',
    footer: {
      text: `${user.username}'s poll`,
      icon_url: user.avatarURL
    }
  }
  const counts = options.map( option => {
    const reaction = message.reactions.find( value => value.emoji.name === option.emoji);
    return { count: _.isNil(reaction) ? 0 : reaction.users.size - 1, text: option.text }
  }).sort( (a, b) => b.count - a.count).forEach( value => {
    embed.description += `\n**${value.text}**: ${value.count} Votes`;
  });
  return embed;
}


export function songEmbed(playing: Track, paused: boolean, next?: Track) {
  const color = { sc: 0xff7700, yt: 0xbb0000, spot: 0x84bd00 }
  const thumbnail = {
    sc: 'https://www.drupal.org/files/project-images/soundcloud-logo.png',
    yt: 'https://images.vexels.com/media/users/3/137425/isolated/preview/f2ea1ded4d037633f687ee389a571086-youtube-icon-logo-by-vexels.png',
    spot: 'https://image.flaticon.com/icons/png/512/226/226773.png'
  }
  const embed: RichEmbedOptions = {
    title : `**${playing.title}**`,
    description : `**${playing.poster}**`,
    color : color[playing.src],
    image : { url : playing.pic },
    thumbnail : {
      url : thumbnail[playing.src]
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
