"use strict"

import * as co from 'co';
import * as _  from 'lodash';

import { DiscordBot }      from '../libs/DiscordBot';
import { QueuePlayer }     from '../libs/QueuePlayer';
import { BotConfig, Daos } from '../typings';
import { Message }         from 'discord.js'

export function addMusicCommands(bot: DiscordBot, config: BotConfig, daos: Daos) {
  const queuePlayerManager = daos.queuePlayerManager;

  const joinHandler = function* (player: QueuePlayer, message: Message) {
    if (bot.voiceIsFull())
      return yield message.reply('There are too many servers listening right now. Try again later!');
    else if (_.isNil(message.member.voiceChannel))
      return yield message.reply('You need to join a voice channel first!');
    try {
      yield player.join(message.member.voiceChannel);
      yield message.react('👏');
    } catch (e) {
      return yield message.reply(e);
    }
  };

  const playHandler = function* (player: QueuePlayer, message: Message) {
    let success = player.play(message);
    if (!success) {
      const err = yield joinHandler(player, message);
      if (err) return;
      success = player.play(message);
    }
    if (success) yield message.reply(success);
  }

  const commands: { [x: string]: (player: QueuePlayer, message: Message, params: string[], level: number) => any} = {

    'volume': co.wrap( function* (player: QueuePlayer, message: Message, params: string[]) {
      if (params.length === 0)
        return yield message.reply(`Current volume: \`${player.getVolume()}%\``);
  
      const resp = player.setVolume(parseInt(params[0]) || -1);
      if (resp) yield message.reply(resp);
    }),

    'join': co.wrap(joinHandler),
    'play': co.wrap(playHandler),

    'pause': co.wrap(function* (player: QueuePlayer, message: Message) {
      const msg = yield player.pauseStream();
      if (msg) yield message.reply(msg);
    }),

    'resume': co.wrap(function* (player: QueuePlayer, message: Message) {
      const msg = yield player.resumeStream();
      if (msg) yield message.reply(msg);
    }),

    'skip': (player: QueuePlayer, message: Message) => {
      const msg = player.skipSong();
      if (msg) message.reply(msg);
      else message.react('👌');
    },

    'stop': (player: QueuePlayer, message: Message) => {
      const resp = player.stopStream();
      if (resp) message.reply(resp);
      else message.react('😢');
    }
  }

  bot.on(config.commands.find(cat => cat.name === 'Music').prefix, (command: string, message: Message, params: string[], level: number) => {
    const player = queuePlayerManager.get(message.guild.id);
    if (player.channel && player.channel.id !== message.channel.id)
      return message.reply(`My music channel has been locked in for \`#${player.channel.name}\`. Try again over there!`);
    commands[command](player, message, params, level);
  });
}
