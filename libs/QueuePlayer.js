"use strict"
const _       = require('lodash');
const request = require('request');
const ytdl    = require('ytdl-core');

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
    this.messageCache = null;
    this.volume = 1;
  }

  enqueue(items, top) {
    if (top) this.list = items.concat(this.list);
    else this.list = this.list.concat(items);
  }

  dequeue() {
    return this.list.shift();
  }

  currentSong() {
    return _.isNil(this.nowPlaying) ? '' : `${!_.isNil(this.dispatcher) && this.dispatcher.paused ? 'PAUSED ~ ' : ''}` +
        `Currently playing: **${this.nowPlaying.title}** posted by **${this.nowPlaying.poster}**`;
  }

  *clear() {
    this.list = [];
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
    return 'Successfully shuffled the queue!';
  }

  // Prints the queue
  show(num, message) {
    if (this.list.length === 0) return 'There is nothing in the queue!';
    else if (this.list.length < num) num = this.list.length;
    let string = `${this.currentSong()}\`\`\`css\n`;
    for (let i = 0; i < num; i++) {
      const song = this.list[i];
      string += `${i + 1}: ${song.title} posted by ${song.poster}\n`;
    }
    string += this.list.length - num > 0 ? `...\nPlus ${this.list.length - num} other songs` : '';
    message.channel.send(`${string}\`\`\``);
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
    return yield this.createStream(message, content);
  }

  // Creates the stream and defines the dispatcher
  createStream(message, content) {
    this.messageCache = message;
    return new Promise((resolve, reject) => {
      if (_.isNil(this.connection)) return resolve(false);
      this.dispatcher = this.connection.playStream(this.getNextStream(), { seek: 0, volume: this.volume, passes: 1 });
      this.dispatcher.on('start', () => {
        this.nowPlaying = this.dequeue();
        message.channel.send(`Now playing: **${this.nowPlaying.title}**`);
        this.client.user.setGame(this.nowPlaying.title);
        console.log(`Streaming: ${this.nowPlaying.title}`);
      })
      this.dispatcher.once('end', reason => {
        this.dispatcher = null;
        if (reason !== "user" && this.list.length > 0) {
          console.log("Creating next stream");
          return this.createStream(this.messageCache);
        }
        this.client.user.setGame(null);
        console.log("Ended music stream");
      });
      this.dispatcher.once('error', err => {
        console.log(err);
      });
      return resolve('Music stream started');
    });
  }

  // Pause the stream
  *pauseStream(message, content) {
    if (_.isNil(this.dispatcher)) return 'I am not playing anything!';
    else if (this.dispatcher.paused) return 'I am already paused!';
    this.dispatcher.pause();
    message.channel.send('---**PAUSED**---');
    return false;
  }

  // Resume the stream
  *resumeStream(message, content) {
    if (_.isNil(this.dispatcher)) return 'There is nothing to resume!';
    else if (!this.dispatcher.paused) return 'I have already started playing!';
    this.dispatcher.resume();
    message.channel.send('---**RESUMED**---');
    return false;
  }

  // Skip the current song
  *skipSong(message, content) {
    if (_.isNil(this.dispatcher)) {
      this.dequeue();
      return "I have skipped the next song!";
    }
    this.dispatcher.end("stream");
    message.channel.send('---**SKIPPED**---');
    return false;
  }

  // Stops the music stream
  *stopStream(message, content) {
    if (_.isNil(this.connection)) return 'I am not connected to a voice channel!';
    if (!_.isNil(this.dispatcher)) this.dispatcher.end('user');
    this.connection.disconnect(); this.voice.leave();
    this.dispatcher = null; this.connection = null; this.voice = null;
    return false;
  }
}

module.exports = QueuePlayer;
