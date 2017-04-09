"use strict"
const _       = require('lodash');
const request = require('request');
const ytdl    = require('ytdl-core');
const co      = require('co');
const fork    = require('child_process').fork;

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
    this.volume = 0.5;
    this.artwork = null;
    this.buttons = null;
    this.child = fork(`./libs/ButtonListener.js`, ['--debug-brk=6001']);
    this.child.on('message', (data) => {
      co.wrap(function* (qp, emoji) {
        if (emoji === '🔀') {
          yield qp.shuffle();
          yield qp.show(10, qp.buttons.src);
        } else if (emoji === '⏏' && qp.list.length) yield qp.show(10, qp.buttons.src);
        else if (emoji === '⏸') yield qp.pauseStream();
        else if (emoji === '▶') yield qp.resumeStream();
        else if (emoji === '⏭') yield qp.skipSong();
        else if (emoji === '⏹') yield qp.stopStream();
      })(this, data.emoji);
    });
    this.child.send({ type : "start", token : this.client.token });
  }

  *enqueue(items, top) {
    if (top) this.list = items.concat(this.list);
    else this.list = this.list.concat(items);
    if (!_.isNil(this.buttons) && this.list.length === items.length) {
      yield this.buttons.src.clearReactions();
      this.buttons = yield addButtons(this.buttons.src, !_.isNil(this.nowPlaying), false, true,
                        !_.isNil(this.dispatcher) && !this.dispatcher.paused);
    }
  }

  dequeue() {
    return this.list.shift();
  }

  *currentSong(channel) {
    if (_.isNil(this.nowPlaying)) return '';
    yield this.artwork.delete();
    this.artwork = yield channel.sendEmbed({ image : { url : this.nowPlaying.pic } });
    if (_.isNil(this.dispatcher)) return '';
    return playMsg(this.nowPlaying, this.dispatcher.paused);
  }

  *clear(message) {
    yield message.delete();
    this.list = [];
    if (!_.isNil(this.buttons)) {
      const newMsg = playMsg(this.nowPlaying, !_.isNil(this.dispatcher) && this.dispatcher.paused);
      if (this.buttons.src.content !== newMsg) this.buttons.src.edit(newMsg);
      yield this.buttons.src.clearReactions();
      this.buttons = yield addButtons(this.buttons.src, !_.isNil(this.nowPlaying), false, false,
                      !_.isNil(this.dispatcher) && !this.dispatcher.paused);
    }
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
  *show(num, message) {
    if (this.list.length === 0) return 'There is nothing in the queue!';
    else if (this.list.length < num) num = this.list.length;
    let string = `${yield this.currentSong(message.channel)}\`\`\`css\n`;
    for (let i = 0; i < num; i++) {
      const song = this.list[i];
      string += `${i + 1}: ${song.title} posted by ${song.poster}\n`;
    }
    string += this.list.length - num > 0 ? `...\nPlus ${this.list.length - num} other songs` : '';
    if (!_.isNil(this.buttons)) yield this.buttons.src.delete();
    const list = yield message.channel.send(`${string}\`\`\``);
    this.buttons = yield addButtons(list, !_.isNil(this.nowPlaying), true, true, !_.isNil(this.dispatcher) && !this.dispatcher.paused);
    this.child.send({ type : "update", chanID : this.buttons.src.channel.id, msgID : this.buttons.src.id });
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
        co.wrap( function* (qp) {
          const artwork   = yield message.channel.sendEmbed({ image : { url : qp.nowPlaying.pic } });
          const msg       = yield message.channel.send(playMsg(qp.nowPlaying, false));
          if (!_.isNil(qp.buttons)) yield qp.buttons.src.delete();
          const buttonMsg = yield addButtons(msg, true, false, qp.list.length, true);
          return { "art" : artwork, "buttons" : buttonMsg };
        })(this).then((data) => {
          this.artwork = data.art;
          this.buttons = data.buttons;
          this.client.user.setGame(this.nowPlaying.title);
          this.child.send({ type : 'update', chanID : this.buttons.src.channel.id, msgID : this.buttons.src.id });
          console.log(`Streaming: ${this.nowPlaying.title}`);
        });
      });
      this.dispatcher.once('end', reason => {
        co.wrap( function* (qp) {
          yield qp.artwork.delete();
          yield qp.buttons.src.clearReactions();
        })(this).then( () => {
          this.buttons.src.edit(`Played: *${this.nowPlaying.title}*`);
          this.dispatcher = null;
          this.buttons = null;
          if (reason !== "user" && this.list.length > 0) {
            console.log("Creating next stream");
            return this.createStream(this.messageCache);
          }
          this.client.user.setGame(null);
          this.child.send({ type : 'stop' });
          this.messageCache.channel.reply(`Music stream ended`);
          console.log("Ended music stream");
        });
      });
      this.dispatcher.once('error', err => {
        console.log(err);
      });
      message.react('🤘').then(() => resolve('Music stream started'));
    });
  }

  // Pause the stream
  *pauseStream(message, content) {
    if (_.isNil(this.dispatcher)) return 'I am not playing anything!';
    else if (this.dispatcher.paused) return 'I am already paused!';
    this.dispatcher.pause();
    if (!_.isNil(message)) yield message.delete();
    yield this.buttons.src.clearReactions();
    this.buttons.src = yield this.buttons.src.edit(playMsg(this.nowPlaying, true));
    this.buttons = yield addButtons(this.buttons.src, true, false, this.list.length, false);
    this.child.send({ type : "update", chanID : this.buttons.src.channel.id, msgID : this.buttons.src.id });
    return false;
  }

  // Resume the stream
  *resumeStream(message, content) {
    if (_.isNil(this.dispatcher)) return 'There is nothing to resume!';
    else if (!this.dispatcher.paused) return 'I have already started playing!';
    this.dispatcher.resume();
    if (!_.isNil(message)) yield message.delete();
    yield this.buttons.src.clearReactions();
    this.buttons.src = yield this.buttons.src.edit(playMsg(this.nowPlaying, false));
    this.buttons = yield addButtons(this.buttons.src, true, false, this.list.length, true);
    this.child.send({ type : "update", chanID : this.buttons.src.channel.id, msgID : this.buttons.src.id });
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

// Adds emoji reactions to a message
function* addButtons(message, isPlaying, showShuffle, showEject, showPause) {
  if (showEject) yield message.react(showShuffle ? '🔀' : '⏏');
  if (!isPlaying) return { src : message, isShuffle : showShuffle };
  yield timeoutPromise(250);
  yield message.react(showPause ? '⏸' : '▶');
  yield timeoutPromise(250);
  yield message.react('⏭');
  yield timeoutPromise(250);
  yield message.react('⏹');
  return { src : message, isShuffle: showShuffle };
}

// So I only have to format this once.
function playMsg(nowPlaying, paused) {
  let msg = paused ? 'Paused: ' : 'Now playing: ';
  msg += `**${nowPlaying.title}** posted by **${nowPlaying.poster}**`;
  return msg;
}

function timeoutPromise(time) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(true);
    }, time);
  });
}

module.exports = QueuePlayer;
