"use strict"

import * as _      from 'lodash';
import * as Embeds from './common/Embeds';

import { Track }            from '../typings';
import { Queue }            from './data/Queue';
import { EmbedButtonMsg }   from './data/EmbedButtonMsg';
import { EventEmitter }     from 'events';
import { TextChannel, Message, MessageCollector } from 'discord.js';

const PLAYER_REACTIONS: { [key: string]: string } = {
  shuffle : '🔀',
  queue   : '⏏',
  pause   : '⏸',
  resume  : '▶',
  skip    : '⏭',
  stop    : '⏹'
};

export class PlayerCards extends EventEmitter {

  private songCard: EmbedButtonMsg;
  private queueCard: EmbedButtonMsg;
  private collector: MessageCollector;
  private playing: Track;
  private paused: boolean = false;
  private showQ: boolean = false;

  constructor(private queue: Queue<Track>) {
    super();
  }

  public setPlaying(playing: Track) { this.playing = playing; }

  public setPaused(paused: boolean) { this.paused = paused; }

  public showQueue() { this.showQ = true; }

  public hideQueue() { this.showQ = false; }

  public newSongCard(channel: TextChannel, buttons: boolean, omitNext?: boolean) {
    const embed = Embeds.songEmbed(this.playing, this.paused, omitNext ? null : this.queue.peek());
    if (_.isNil(this.songCard) || !this.songCard.isEqual(embed) || channel.id !== this.songCard.chanID) {
      this.deleteCards();
      this.songCard = new EmbedButtonMsg(embed, this.getReactions(omitNext));
      if (buttons) this.songCard.on('reaction', this.reactionHandler);
      if (!omitNext) this.createCollector(channel);
      return this.songCard.sendCard(channel, buttons);
    } else if (!this.songCard.hasButtons() && !omitNext) {
      if (this.queueCard) this.queueCard.delete();
      return this.songCard.addButtons(this.getReactions(false));
    } else if (this.songCard.hasButtons()) {
      return this.songCard.clearButtons();
    }
    return Promise.resolve();
  }

  public newQueueCard(channel: TextChannel) {
    if (this.playing) {
      return new Promise(resolve => {
        this.newSongCard(channel, false, true).then( () => {
          this.createQueueCard(channel).then(resolve);
        });
      });
    }
    return this.createQueueCard(channel);
  }

  private createQueueCard(channel: TextChannel) {
    const embed = Embeds.queueEmbed(this.queue);
    if (_.isNil(this.queueCard) || !this.queueCard.isEqual(embed) || channel.id !== this.queueCard.chanID) {
      if (this.queueCard) this.queueCard.delete();
      if (this.collector) this.collector.stop();
      this.createCollector(channel);
      this.queueCard = new EmbedButtonMsg(embed, this.getReactions(true));
      this.queueCard.on('reaction', this.reactionHandler);
      return this.queueCard.sendCard(channel, true);
    }
    return this.queueCard.addButtons(this.getReactions(true));
  }

  public updateCards() {
    if (this.queueCard && this.showQueue) {
      return this.newQueueCard(this.queueCard.channel);
    } else if (this.songCard) {
      return this.newSongCard(this.songCard.channel, true);
    }
    return Promise.resolve(this.deleteCards());
  }

  public deleteCards() {
    let didDelete = false;
    if (this.collector) this.collector.stop();
    if (this.songCard) {
      this.songCard.delete();
      this.songCard = null;
      didDelete = true;
    }
    if (this.queueCard) {
      this.queueCard.delete();
      this.queueCard = null;
      didDelete = true;
    }
    return didDelete;
  }

  private createCollector(channel: TextChannel) {
    this.collector = new MessageCollector(channel, (message: Message) => {
      let check = true;
      if (this.songCard) check = this.songCard.msgID && message.id !== this.songCard.msgID;
      if (this.queueCard) check = check && this.queueCard.msgID && message.id !== this.queueCard.msgID;
      return check;
    });
    this.collector.on('collect', message => {
      setTimeout(() => { message.delete(); }, 3000);
    })
    this.collector.on('end', () => {
      this.collector = null;
    });
  }

  private reactionHandler = (emoji: string) => {
    const match = _.findKey(PLAYER_REACTIONS, (validEmoji: string) => emoji === validEmoji);
    if (!_.isNil(match)) this.emit('reaction', match);
  }
  
  private getReactions(showShuffle: boolean) {
    const reactions: string[] = [];
    if (this.queue.size()) reactions.push(showShuffle ? PLAYER_REACTIONS.shuffle : PLAYER_REACTIONS.queue);
    if (_.isNil(this.playing)) return reactions;
    reactions.push(this.paused ? PLAYER_REACTIONS.resume : PLAYER_REACTIONS.pause);
    reactions.push(PLAYER_REACTIONS.skip, PLAYER_REACTIONS.stop);
    return reactions;
  }
}
