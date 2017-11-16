"use strict"

import * as _  from 'lodash';

import { DiscordBot }      from '../libs/DiscordBot';
import { QueuePlayer }     from '../libs/QueuePlayer';
import { BotConfig, Daos } from '../typings';
import { Message }         from 'discord.js'

export function addMusicCommands(bot: DiscordBot, config: BotConfig, daos: Daos) {
  const queuePlayerManager = daos.queuePlayerManager;

  const joinHandler = async (player: QueuePlayer, message: Message) => {
    if (bot.voiceIsFull())
      return await message.reply('There are too many servers listening right now. Try again later!');
    else if (_.isNil(message.member.voiceChannel))
      return await message.reply('You need to join a voice channel first!');
    try {
      await player.join(message.member.voiceChannel);
      await message.react('👏');
    } catch (e) {
      return await message.reply(e);
    }
  };

  const playHandler = async (player: QueuePlayer, message: Message) => {
    let success = await player.play(message);
    if (!success) {
      const err = await joinHandler(player, message);
      if (err) return;
      success = await player.play(message);
    }
    if (success) await message.reply(success);
  }

  const commands: { [x: string]: (player: QueuePlayer, message: Message, params: string[], level: number) => any} = {

    'volume': async (player: QueuePlayer, message: Message, params: string[]) => {
      if (params.length === 0)
        return await message.reply(`Current volume: \`${player.getVolume()}%\``);
  
      const resp = player.setVolume(parseInt(params[0]) || -1);
      await message.reply(_.isNil(resp) ? `The volume is now \`${player.getVolume()}%\`` : resp);
    },

    'join': joinHandler,
    'play': playHandler,

    'pause': async (player: QueuePlayer, message: Message) => {
      const msg = await player.pauseStream();
      if (msg) await message.reply(msg);
    },

    'resume': async (player: QueuePlayer, message: Message) => {
      const msg = await player.resumeStream();
      if (msg) await message.reply(msg);
    },

    'skip': async (player: QueuePlayer, message: Message) => {
      const msg = await player.skipSong();
      if (msg) await message.reply(msg);
      else await message.react('👌');
    },

    'stop': async (player: QueuePlayer, message: Message) => {
      const resp = player.stopStream();
      if (resp) await message.reply(resp);
      else await message.react('😢');
    }
  }

  bot.on(config.commands.find(cat => cat.name === 'Music').prefix, (command: string, message: Message, params: string[], level: number) => {
    const player = queuePlayerManager.get(message.guild.id);
    if (player.channel && player.channel.id !== message.channel.id)
      return message.reply(`My music channel has been locked in for \`#${player.channel.name}\`. Try again over there!`);
    commands[command](player, message, params, level);
  });
}
