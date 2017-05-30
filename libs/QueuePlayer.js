"use strict"
const _              = require('lodash');
const request        = require('request');
const ytdl           = require('ytdl-core');
const co             = require('co');
const PlayCardManager = require('./PlayCardManager.js');

class QueuePlayer {
  constructor(client, SC, YT) {
    this.client = client;
    this.SC = SC;
    this.YT = YT;
    this.list = [];
    this.nowPlaying = null;

    this.voice = null;
    this.connection = null;
    this.dispatcher = null;
    this.volume = 0.5;

    this.messageCache = null;

    this.pcMnger = new PlayCardManager();
    this.pcMnger.on('reaction', emoji => {
      co.wrap(function* (qp, emoji) {
        if (emoji === '🔀') yield qp.shuffle();
        else if (emoji === '⏏' && qp.list.length) yield qp.show(10, qp.messageCache);
        else if (emoji === '⏸') yield qp.pauseStream();
        else if (emoji === '▶') yield qp.resumeStream();
        else if (emoji === '⏭') yield qp.skipSong();
        else if (emoji === '⏹') yield qp.stopStream();
      })(this, emoji);
    })
  }

  *enqueue(items, top) {
    if (top) this.list = items.concat(this.list);
    else this.list = this.list.concat(items);
    const numItems = Math.min(10, this.list.length);
    this.pcMnger.setVarious({ 
      next : this.peek(), 
      queue : { total : this.list.length, num : numItems, list : this.list.slice(0, numItems) } 
    });
    yield this.pcMnger.updateCards();
  }

  dequeue() {
    return this.list.shift();
  }

  peek() {
    return this.list.length > 0 ? this.list[0] : null;
  }

  *clear(message) {
    this.list = [];
    this.pcMnger.setVarious({ next: null, queue: null })
    yield this.pcMnger.updateCards();
    return 'I have cleared the queue';
  }

  remove(begin, num) {
    this.list.splice(begin, num);
  }

  // Shuffles the queue or an input list
  *shuffle(message, content, list) {
    const copy = list ? list : this.list;
    for (let i = 0; i < copy.length; i++) {
      const rand = Math.floor(Math.random() * copy.length);
      const temp = copy[rand];
      copy[rand] = copy[i];
      copy[i] = temp;
    }
    if (list) return copy;
    this.list = copy;
    const items = this.pcMnger.queue;
    items.list = this.list.slice(0, items.num);
    this.pcMnger.setVarious({ next : this.peek(), queue : items });
    yield this.pcMnger.updateCards();
    return 'Successfully shuffled the queue!';
  }

  // Prints the queue
  *show(numItems, message) {
    if (this.list.length === 0) return 'There is nothing in the queue!';
    else if (this.list.length < numItems) numItems = this.list.length;
    this.pcMnger.setQueue({ total: this.list.length, num: numItems, list: this.list.slice(0, numItems) });
    yield this.pcMnger.newQueueCard(message.channel);
    if (!message.author.bot) this.messageCache = message;
    return false;
  }

  // Shows the volume or takes in new volume
  *changeVolume(message, content) {
    if (content.length < 2) return `Current volume: \`${this.volume * 100}%\``;
    const newVol = parseInt(content[1]) || -1;
    if (newVol < 0 || newVol > 100) return 'Invalid volume! Choose a number between 0-100%'
    this.volume = newVol / 100;
    if (!_.isNil(this.dispatcher)) this.dispatcher.setVolume(this.volume);
    return `The volume is now \`${newVol}%\``;
  }

  // Returns a readable stream for the song
  getNextStream() {
    if (this.list[0].src === 'sc') return request(`${this.list[0].stream_url}?client_id=${this.SC.CLIENT_ID}`);
    return ytdl(this.list[0].url, { format : 'audioonly' });
  }

  // Joins the voice channel of the user
  *joinVoice(message, content) {
    if (_.isNil(message.member.voiceChannelID)) return 'You need to join a voice channel first!';
    else if (!_.isNil(this.connection) && this.connection.channel.id === message.member.voiceChannelID) return `I'm already there!`;
    this.voice = this.client.channels.get(message.member.voiceChannelID);
    this.connection = yield this.voice.join();
    yield message.react('👏');
    return false;
  }

  // First ensures that bot is joined to voice channel then starts music stream
  *playStream(message, content) {
    if (this.list.length === 0) return 'There is nothing in the queue!';
    else if (!_.isNil(this.dispatcher)) return 'I am already streaming!';
    else if (_.isNil(this.voice) || _.isNil(this.connection)) {
      const resp = yield this.joinVoice(message, content);
      if (resp) return resp;
    }
    const reply = yield this.createStream(message, content);
    message.react('🤘');
    return reply;
  }

  // Creates the stream and defines the dispatcher
  createStream(message, content) {
    this.messageCache = message;
    return new Promise((resolve, reject) => {
      if (_.isNil(this.connection)) return resolve(false);
      this.dispatcher = this.connection.playStream(this.getNextStream(), { seek: 0, volume: this.volume, passes: 1 });
      
      this.dispatcher.on('start', () => {
        this.nowPlaying = this.dequeue();
        this.pcMnger.setVarious({ playing : this.nowPlaying, next: this.peek() })
        this.client.user.setGame(this.nowPlaying.title);
        co.wrap( function* (qp) {
          yield qp.pcMnger.newSongCard(qp.messageCache.channel, true);
        })(this)
        console.log(`Streaming: ${this.nowPlaying.title}`);
      });

      // #TODO ~ Remove timeout when discord.js library fixes double 'end' emit
      this.dispatcher.once('end', reason => {
        this.dispatcher = null;
        this.pcMnger.deleteCards();
        this.messageCache.channel.send(`Played: *${this.nowPlaying.title}*`);
        if (reason !== "user" && this.list.length > 0) {
          console.log("Creating next stream");
          setTimeout(() => { this.createStream(this.messageCache); }, 50);
          return;
        }
        this.pcMnger.setPlaying(null);
        this.client.user.setGame(null);
        this.messageCache.reply(`Music stream ended`);
        console.log("Ended music stream");
      });
      
      resolve('Music stream started');
    });
  }

  // Pause the stream
  *pauseStream(message, content) {
    if (_.isNil(this.dispatcher)) return 'I am not playing anything!';
    else if (this.dispatcher.paused) return 'I am already paused!';
    this.dispatcher.pause();
    this.pcMnger.setPaused(true);
    yield this.pcMnger.updateCards();
    return false;
  }

  // Resume the stream
  *resumeStream(message, content) {
    if (_.isNil(this.dispatcher)) return 'There is nothing to resume!';
    else if (!this.dispatcher.paused) return 'I have already started playing!';
    this.dispatcher.resume();
    this.pcMnger.setPaused(false);
    yield this.pcMnger.updateCards();
    return false;
  }

  // Skip the current song
  *skipSong(message, content) {
    if (_.isNil(this.dispatcher)) {
      this.dequeue();
      return "I have skipped the next song!";
    }
    if (!_.isNil(message)) yield message.react('👌');
    this.dispatcher.end("stream");
    return false;
  }

  // Stops the music stream
  *stopStream(message, content) {
    if (_.isNil(this.connection)) return 'I am not connected to a voice channel!';
    if (!_.isNil(this.dispatcher)) this.dispatcher.end('user');
    this.connection.disconnect(); this.voice.leave();
    this.dispatcher = null; this.connection = null; this.voice = null;
    if (!_.isNil(message)) yield message.react('😢');
    return false;
  }
}

module.exports = QueuePlayer;
