"use strict"

import { Message, MessageReaction, TextChannel, VoiceChannel, VoiceConnection } from 'discord.js';
import * as _ from 'lodash';
import { Track } from '../typings';
import { Cache } from './data/Cache';
import { Queue } from './data/Queue';
import { PlayerCards } from './PlayerCards';
import { StreamService } from './services/StreamService';


export class QueuePlayer {

  private nowPlaying: Track;
  private queue: Queue<Track>;
  private connection: VoiceConnection;
  private pcMnger: PlayerCards;
  public messageCache: Message;
  private volume: number = 0.5;

  constructor(private cache: Cache, private cacheId: string, private ttl: number, private streamService: StreamService) {
    this.queue = new Queue();
    this.pcMnger = new PlayerCards(this.queue);
    this.pcMnger.on('reaction', (reaction: MessageReaction, action) => {
      if (this.isInVoiceChannel()) {
        const badUsers = reaction.users.filter(x => !x.bot && _.isNil(this.connection.channel.members.get(x.id)));
        if (badUsers.size > 0) return badUsers.forEach(x => reaction.remove(x));
      }
      switch (action) {
        case 'shuffle': this.shuffle(); break;
        case 'queue': this.show(); break;
        case 'pause': this.pauseStream(); break;
        case 'resume': this.resumeStream(); break;
        case 'skip': this.skipSong(); break;
        case 'stop': this.stopStream(); break;
        default:
      }
    });
  }

  public get queuedTracks() {
    return this.queue.size();
  }

  public get channel() {
    return _.isNil(this.messageCache) ? null : this.messageCache.channel as TextChannel;
  }

  public async enqueue(items: Track[], top: boolean) {
    this.refreshCache();
    this.queue.push(items, top);
    await this.pcMnger.updateCards();
  }

  public async clear() {
    this.refreshCache();
    this.queue.clear();
    this.pcMnger.hideQueue();
    await this.pcMnger.updateCards();
  }

  public async shuffle() {
    if (this.queue.size() === 0)
      return 'There is nothing to shuffle!';
    this.refreshCache();
    this.queue.shuffle();
    await this.pcMnger.updateCards();
  }

  public async show(message?: Message) {
    if (this.queue.size() === 0)
      return 'There is nothing in the queue!';
    if (!_.isNil(message) && !message.author.bot) this.messageCache = message;
    this.pcMnger.showQueue();
    await this.pcMnger.newQueueCard(this.messageCache.channel as TextChannel);
  }

  public getVolume() {
    return this.volume * 100;
  }

  public setVolume(newVol: number): string {
    if (newVol < 0 || newVol > 100)
      return 'Invalid volume! Choose a number between 0-100%';
    this.refreshCache();
    this.volume = newVol / 100;
    if (this.isStreaming())
      this.connection.dispatcher.setVolume(this.volume);
  }

  public async join(voiceChannel: VoiceChannel) {
    if (this.isInVoiceChannel() && this.connection.channel.id === voiceChannel.id)
      throw new Error('I am already there!');
    else if (voiceChannel.full)
      throw new Error('That voice channel is full!');
    this.connection = await voiceChannel.join();
  }

  public async play(message: Message) {
    if (this.queue.size() === 0) return 'There is nothing in the queue!';
    else if (this.isStreaming()) return 'I am already streaming!';
    else if (!this.isInVoiceChannel()) return;
    this.messageCache = message;
    await this.messageCache.react('🤘');
    // this.messageCache.channel.send(`**I will now start deleting received messages a few seconds after they come in. ` +
    //   `If you don't want me to do this here then use \`${this.config.commandToken}${this.config.commands.find(cat => cat.name === 'Queue').prefix}.show\` ` +
    //   `in another channel to move all music spam there.**`);
    return this.createStream();
  }

  public async pauseStream() {
    if (!this.isStreaming()) return 'I am not playing anything!';
    else if (this.isPaused()) return 'I am already paused!';
    this.connection.dispatcher.pause();
    this.pcMnger.setPaused(true);
    await this.pcMnger.updateCards();
  }

  public async resumeStream() {
    if (!this.isStreaming()) return 'There is nothing to resume!';
    else if (!this.isPaused()) return 'I have already started playing!';
    this.refreshCache();
    this.connection.dispatcher.resume();
    this.pcMnger.setPaused(false);
    await this.pcMnger.updateCards();
  }

  public async skipSong() {
    if (!this.isStreaming()) {
      if (!this.queue.size()) return 'There is nothing to skip!';
      this.refreshCache();
      this.queue.pop();
      await this.pcMnger.updateCards();
      return 'I have skipped the next song!';
    }
    this.connection.dispatcher.end('skipped');
  }

  public stopStream() {
    if (!this.isInVoiceChannel()) return 'I am not connected to a voice channel!';
    else if (this.isStreaming()) this.connection.dispatcher.end('forceStop');
    this.connection.disconnect();
    this.connection = null;
  }

  public async close(reason?) {
    if (this.pcMnger.deleteCards() && !_.isNil(this.messageCache)) {
      await this.messageCache.channel.send(reason ? reason : "**Closing music session due to inactivity**");
    }
    this.stopStream();
  }

  private refreshCache() {
    this.cache.refresh(this.cacheId, this.ttl);
  }

  private isInVoiceChannel() {
    return !_.isNil(this.connection);
  }

  public isStreaming() {
    return this.isInVoiceChannel() && !_.isNil(this.connection.dispatcher);
  }

  private isPaused() {
    return this.isStreaming() && this.connection.dispatcher.paused;
  }

  private createStream() {
    this.refreshCache();
    this.nowPlaying = this.queue.pop();
    this.streamService.getTrackStream(this.nowPlaying, (stream) => {
      this.pcMnger.setPlaying(this.nowPlaying);
      this.pcMnger.newSongCard(this.messageCache.channel as TextChannel, true);
      this.connection.playStream(stream, { seek: 0, volume: this.volume, passes: 1 });
      this.connection.dispatcher.once('start', () => console.log(`Streaming: ${this.nowPlaying.title}`));
      this.connection.dispatcher.once('end', reason => {
        stream.destroy();
        this.pcMnger.deleteCards();
        this.pcMnger.setPaused(false);
        this.pcMnger.hideQueue();
        this.messageCache.channel.send(`Played: *${this.nowPlaying.title}*`);
        if (reason !== 'forceStop') {
          if (this.connection.channel.members.every(member => member.deaf || member.user.bot)) {
            this.messageCache.channel.send('Stopping stream since no one is listening');
            this.connection.disconnect();
          } else if (this.queue.size() > 0) {
            console.log('Creating next stream');
            return setTimeout(() => this.createStream(), 50);
          }
        }
        this.pcMnger.setPlaying(null);
        this.messageCache.reply('Music stream ended');
        this.messageCache = null;
        console.log('Ended music stream');
      });
      this.connection.dispatcher.on('error', e => {
        console.log(`${this.cacheId} encountered error`, e);
      })
    });
    return 'Music stream started';
  }
}
