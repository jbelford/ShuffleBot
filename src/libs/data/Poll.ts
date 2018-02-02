"use strict"

import * as Embeds from '../common/Embeds';
import * as Utils  from '../common/Utils';

import { PollOption } from '../../typings';
import { Cache }      from './Cache';
import { TextChannel, User, ReactionCollector, Emoji, RichEmbedOptions, Message, MessageReaction } from 'discord.js';

const stopReaction = '🚫';

export class Poll {
  
  private collector: ReactionCollector;
  private embed: RichEmbedOptions;
  public active = false;

  constructor(private question: string, private options: PollOption[], private user: User) {
    this.embed = Embeds.pollEmbed(this.question, this.options, user);
  }
  
  public async send(channel: TextChannel) {
    this.active = true;
    const msg = await channel.send({ embed: this.embed }) as Message;
    await this.user.send(`The poll has been created!\n` + 
      `I will automatically end it in a few hours but you can ` +
      `end it early by reacting to it with '${stopReaction}'.`);
    const reactions = this.options.map(option => option.emoji);
    reactions.push(stopReaction);
    await Utils.reactSequential(msg, reactions);
    this.collector = msg.createReactionCollector((reaction: MessageReaction, reactor: User) => {
      return reaction.emoji.name === stopReaction && reactor.id === this.user.id;
    });
    this.collector.on('collect', reaction => this.close());
  }

  public async close() {
    if (this.collector) {
      const message = this.collector.message;
      await message.channel.send({ embed: Embeds.pollResultsEmbed(this.question, this.options, message, this.user)})
      await message.delete();
      this.collector.stop();
      this.active = false;
    }
  }
}