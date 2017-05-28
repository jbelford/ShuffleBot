"use strict"

const _              = require('lodash');
const timeoutPromise = require('./Misc.js').timeoutPromise;

class PlayCard {
  constructor(embed, isQueue, buttonOptions) {
    this.isQueue = isQueue;
    this.bOpts = buttonOptions;
    this.embed = embed;
    this.src = null;
  }

  get chanID() {
    return this.src.channel.id;
  }
  get msgID() {
    return this.src.id;
  }

  get channel() {
    return this.src.channel;
  }

  *sendCard(channel, buttons) {
    this.src = yield channel.sendEmbed(this.embed);
    if (buttons) yield this.addButtons();
  }

  update(newEmbed) {
    if (JSON.stringify(newEmbed) === JSON.stringify(this.embed)) return;
    this.embed = newEmbed;
    this.src.edit({ embed : newEmbed });
  }

  // Adds emoji reactions to the message
  *addButtons() {
    if (this.bOpts.hasNext) yield this.src.react(this.isQueue ? '🔀' : '⏏');
    if (!this.bOpts.isPlaying) return;
    yield timeoutPromise(150);
    yield this.src.react(this.bOpts.paused ? '▶' : '⏸');
    yield timeoutPromise(150);
    yield this.src.react('⏭');
    yield timeoutPromise(150);
    yield this.src.react('⏹');
  }
  
  clearButtons() {
    this.src.clearReactions();
  }

  delete() {
    if (this.src) this.src.delete();
  }
}

class PlayCardManager {
  constructor() {
    this.songCard = null;
    this.queueCard = null;
    this.playing = null;
    this.next = null;
    this.queue = null;
    this.paused = false;
    this.buttonOptions = {
      isPlaying: false,
      paused: false,
      hasNext: false
    }
  }

  setPlaying(playing) {
    this.playing = playing;
    this.buttonOptions.isPlaying = playing !== null;
  }

  setNext(next) {
    this.next = next;
    this.buttonOptions.hasNext = next !== null;
  }

  setPaused(paused) {
    this.paused = paused;
    this.buttonOptions.paused = this.paused;
  }

  setQueue(queue) {
    this.queue = queue;
  }

  setVarious(features) {
    if ("playing" in features) this.setPlaying(features.playing);
    if ("next" in features) this.setNext(features.next);
    if ("paused" in features) this.setPaused(features.paused);
    if ("queue" in features) this.setQueue(features.queue);
  }

  *newSongCard(channel, buttons, omitNext) {
    this.deleteCards();
    const embed = createSongEmbed(this.playing, this.paused, omitNext ? null : this.next);
    this.songCard = new PlayCard(embed, false, this.buttonOptions);
    yield this.songCard.sendCard(channel, buttons);
    return { type : 'update', chanID : channel.id, msgID : this.songCard.msgID }
  }

  *newQueueCard(channel) {
    this.deleteCards();
    if (!_.isNil(this.playing)) yield this.newSongCard(channel, false, true);
    const embed = createQueueEmbed(this.queue);
    this.queueCard = new PlayCard(embed, true, this.buttonOptions);
    yield this.queueCard.sendCard(channel, true);
    return { type : 'update', chanID : channel.id, msgID : this.queueCard.msgID }
  }

  *updateCards() {
    let childMsg = null;
    if (this.queueCard && this.queue) {
      childMsg = yield this.newQueueCard(this.queueCard.channel);
    } else if (this.songCard) {
      childMsg = yield this.newSongCard(this.songCard.channel, true);
    }
    return childMsg;
  }

  // Delete the playcards
  deleteCards() {
    if (this.songCard) this.songCard.delete();
    if (this.queueCard) this.queueCard.delete();
    this.songCard = null;
    this.queueCard = null;
  }

}

// Create the embed for player card message
function createSongEmbed(playing, paused, next) {
  const embed = {
    title : `**${playing.title}**`,
    description : `**${playing.poster}**`,
    color : playing.src === "sc" ? 0xff7700 : 0xbb0000,
    image : { url : playing.pic },
    thumbnail : {
      url : playing.src === "sc" ? 'https://www.drupal.org/files/project-images/soundcloud-logo.png' :
            'https://img.clipartfest.com/93cb13327aaaf52d1e975992b7fced5f_download-this-image-as-youtube-play-clipart_600-421.png'
    },
    author : {
      name : paused ? "Paused" : "Now Playing",
      icon_url : paused ? 'http://icons.iconarchive.com/icons/graphicloads/100-flat/128/pause-icon.png' :
                  'https://maxcdn.icons8.com/Share/icon/Media_Controls//circled_play1600.png'
    }
  }
  if (!_.isNil(next)) {
    embed.footer = {
      text : `Up next: ${next.title}`,
      icon_url : next.pic
    }
  }
  return embed;
}

// Create an embed for a queue card
function createQueueEmbed(queue) {
  const queueEmbed = {
    color : 0x1B9857,
    description : '',
    author : {
      name : "Queue",
      icon_url : "https://cdn0.iconfinder.com/data/icons/audio-visual-material-design-icons/512/queue-music-512.png"
    }
  }
  for (let i = 0; i < queue.num; i++) {
    const song = queue.list[i];
    queueEmbed.description += `${i + 1}:\t**${song.title}**\n`;
  }
  if (queue.total - queue.num > 0)
    queueEmbed.footer = { text : `Plus ${queue.total - queue.num} other songs` };
  return queueEmbed;
}

module.exports = PlayCardManager;
