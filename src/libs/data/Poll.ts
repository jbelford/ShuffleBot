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
  
  public send(channel: TextChannel) {
    this.active = true;
    return channel.send({ embed: this.embed }).then( (msg: Message) => {
      this.user.send(`The poll has been created!\n` + 
        `I will automatically end it in a few hours but you can end it early by reacting to it with '${stopReaction}'.`);
      const reactions = this.options.map(option => option.emoji);
      reactions.push(stopReaction);
      Utils.reactSequential(msg, reactions);
      this.collector = msg.createReactionCollector((reaction: MessageReaction, reactor: User) => {
        return reaction.emoji.name === stopReaction && reactor.id === this.user.id;
      });
      this.collector.on('collect', reaction => this.close());
    });
  }

  public close() {
    if (this.collector) {
      const message = this.collector.message;
      message.channel.send({ embed: Embeds.pollResultsEmbed(this.question, this.options, message, this.user)})
      message.delete();
      this.collector.stop();
      this.active = false;
    }
  }
}