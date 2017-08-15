"use strict"

import * as co from 'co';
import * as _  from 'lodash';

import { DiscordBot }      from '../../libs/DiscordBot';
import { BotConfig, Daos } from '../../typings';
import { Message }         from 'discord.js'

export function addPlayerCommands(bot: DiscordBot, config: BotConfig, daos: Daos) {
  const queuePlayerManager = daos.queuePlayerManager;

  const joinHandler = function* (message: Message) {
    if (_.isNil(message.member.voiceChannel))
      return yield message.reply('You need to join a voice channel first!');
    try {
      yield queuePlayerManager.get(message.guild.id).join(message.member.voiceChannel);
      yield message.react('👏');
    } catch (e) {
      return yield message.reply(e);
    }
  };

  const playHandler = function* (message: Message) {
    const player = queuePlayerManager.get(message.guild.id);
    let success = player.play(message);
    if (!success) {
      const err = yield joinHandler(message);
      if (err) return;
      success = player.play(message);
    }
    if (success) yield message.reply(success);
  }

  bot.on('volume', co.wrap( function* (message: Message, params: string[]) {
    const player = queuePlayerManager.get(message.guild.id);
    if (params.length === 0) {
      return yield message.reply(`Current volume: \`${player.getVolume()}%\``);
    }
    const resp = player.setVolume(parseInt(params[0]) || -1);
    yield message.reply(resp);
  }));

  bot.on('join', co.wrap(joinHandler));
  bot.on('play', co.wrap(playHandler));

  bot.on('pause', co.wrap(function* (message: Message) {
    const msg = yield queuePlayerManager.get(message.guild.id).pauseStream();
    if (msg) yield message.reply(msg);
  }));

  bot.on('resume', co.wrap(function* (message: Message) {
    const msg = yield queuePlayerManager.get(message.guild.id).resumeStream();
    if (msg) yield message.reply(msg);
  }));

  bot.on('skip', (message: Message) => {
    const msg = queuePlayerManager.get(message.guild.id).skipSong();
    if (msg) message.reply(msg);
    else message.react('👌');
  });

  bot.on('stop', (message: Message) => {
    const resp = queuePlayerManager.get(message.guild.id).stopStream();
    if (resp) message.reply(resp);
    else message.react('😢');
  });
}
