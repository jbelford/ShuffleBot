"use strict"

const PlayCard = require('./PlayCard.js');
const EventEmitter = require('events');
const MessageCollector = require('discord.js').MessageCollector;

class PlayCardManager extends EventEmitter {
  constructor() {
    super();
    this.songCard = null;
    this.queueCard = null;
    this.playing = null;
    this.next = null;
    this.queue = null;
    this.paused = false;
    this.collector = null;
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
    this.msgCol = null;
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

  // Creates/updates a song embed message
  *newSongCard(channel, buttons, omitNext) {
    const embed = createSongEmbed(this.playing, this.paused, omitNext ? null : this.next);
    if (!this.songCard || !this.songCard.isEqual(embed) || channel.id !== this.songCard.chanID) {
      this.deleteCards();
      this.songCard = new PlayCard(embed, false, this.buttonOptions);
      yield this.songCard.sendCard(channel, buttons);
      this.songCard.on('reaction', emoji => { this.emit('reaction', emoji); });
      if (!omitNext) this.createCollector(channel);
    } else if (!this.songCard.hasButtons() && !omitNext) {
      if (this.queueCard) this.queueCard.delete();
      yield this.songCard.addButtons(this.buttonOptions);
    } else if (this.songCard.hasButtons()) {
      yield this.songCard.clearButtons();
    }
  }

  // Creates/updates a queue embed message as well as song embed if playing
  *newQueueCard(channel) {
    if (this.playing) yield this.newSongCard(channel, false, true);
    const embed = createQueueEmbed(this.queue);
    if (!this.queueCard || !this.queueCard.isEqual(embed) || channel.id !== this.queueCard.chanID) {
      if (this.queueCard) this.queueCard.delete();
      if (this.collector) this.collector.stop();
      this.queueCard = new PlayCard(embed, true, this.buttonOptions);
      yield this.queueCard.sendCard(channel, true);
      this.queueCard.on('reaction', emoji => { this.emit('reaction', emoji); });
      this.createCollector(channel);
    } else {
      yield this.queueCard.clearButtons();
      yield this.queueCard.addButtons(this.buttonOptions);
    }
  }

  // Call this when properties have been changed
  *updateCards() {
    if (this.queueCard && this.queue) {
      yield this.newQueueCard(this.queueCard.channel);
    } else if (this.songCard) {
      yield this.newSongCard(this.songCard.channel, true);
    }
  }

  // Delete the playcards
  deleteCards() {
    if (this.collector) this.collector.stop();
    if (this.songCard) this.songCard.delete();
    if (this.queueCard) this.queueCard.delete();
    this.songCard = null;
    this.queueCard = null;
  }

  // Create a message collector to remove messages while playing
  createCollector(channel) {
    this.collector = new MessageCollector(channel, message => {
      let check = message.id !== this.songCard.msgID;
      if (this.queueCard) check = check && message.id !== this.queueCard.msgID;
      return check;
    });
    this.collector.on('collect', message => {
      setTimeout(() => { message.delete(); }, 2000);
    });
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
  if (next) {
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
  queue.list.forEach((song, idx) => {
    queueEmbed.description += `${idx + 1}:\t**${song.title}**\n`;
  });
  if (queue.total - queue.num > 0)
    queueEmbed.footer = { text : `Plus ${queue.total - queue.num} other songs` };
  return queueEmbed;
}

module.exports = PlayCardManager;
