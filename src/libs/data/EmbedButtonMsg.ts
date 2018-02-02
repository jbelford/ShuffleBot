"use strict"

import * as _     from 'lodash';
import * as Utils from '../common/Utils';

import { EventEmitter } from 'events';
import { User, Message, MessageReaction, ReactionCollector, TextChannel, RichEmbedOptions, ReactionEmoji } from 'discord.js';

export class EmbedButtonMsg extends EventEmitter {

  private src: Message;
  private buttons: boolean = false;
  private collector: ReactionCollector;

  constructor(private embed: RichEmbedOptions, private reactions: string[]) {
    super();
  }

  get chanID() {
    return this.src ? this.src.channel.id : null;
  }
  
  get msgID() {
    return this.src ? this.src.id : null;
  }

  get channel() {
    return this.src ? this.src.channel as TextChannel : null;
  }

  public hasButtons() {
    return this.buttons;
  }

  // Send the card to the channel
  public async sendCard(channel: TextChannel, buttons: boolean) {
    this.src = await channel.send({ embed: this.embed }) as Message;
    if (buttons) await this.addButtons();
  }

  public isEqual(newEmbed: RichEmbedOptions) {
    return JSON.stringify(newEmbed) === JSON.stringify(this.embed);
  }

  // Adds emoji reactions to the message
  public async addButtons(reactions?: string[]) {
    if (reactions) {
      if (this.buttons && JSON.stringify(this.reactions) === JSON.stringify(reactions)) 
        return;
      this.reactions = reactions;
    } else if (this.buttons) return;
    await this.clearButtons();
    this.buttons = true;
    this.createCollector();
    await Utils.reactSequential(this.src, this.reactions);
  }
  
  public async clearButtons() {
    if (!this.buttons) return;
    this.buttons = false;
    this.collector.stop();
    await this.src.clearReactions();
  }

  // Create a collector to listen for reactions to the message
  public createCollector() {
    this.collector = this.src.createReactionCollector((reaction: MessageReaction, user: User) => {
      return this.reactions.includes(reaction.emoji.name) && !user.bot
    });
    this.collector.on('collect', (reaction: MessageReaction) => this.emit('reaction', reaction));
  }

  public async delete() {
    if (this.collector && !this.collector.ended) this.collector.stop();
    if (this.src) await this.src.delete();
  }
}
