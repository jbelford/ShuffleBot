"use strict"

const _              = require('lodash');
const EventEmitter   = require('events');

const validReactions = ['🔀', '⏏', '▶', '⏸', '⏭', '⏹'];

class PlayCard extends EventEmitter {
  constructor(embed, isQueue, buttonOptions) {
    super();
    this.isQueue = isQueue;
    this.bOpts = buttonOptions;
    this.embed = embed;
    this.src = null;
    this.buttons = false;
    this.collector = null;
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

  hasButtons() {
    return this.buttons;
  }

  // Send the card to the channel
  *sendCard(channel, buttons) {
    this.src = yield channel.send({ embed : this.embed });
    if (buttons) yield this.addButtons();
  }

  isEqual(newEmbed) {
    return JSON.stringify(newEmbed) === JSON.stringify(this.embed);
  }

  // Adds emoji reactions to the message
  *addButtons(buttonOptions) {
    if (buttonOptions) this.bOpts = buttonOptions;
    this.buttons = true;
    this.createCollector();
    if (this.bOpts.hasNext) yield this.src.react(this.isQueue ? '🔀' : '⏏');
    if (!this.bOpts.isPlaying) return;
    yield this.src.react(this.bOpts.paused ? '▶' : '⏸');
    yield this.src.react('⏭');
    yield this.src.react('⏹');
  }
  
  *clearButtons() {
    yield this.src.clearReactions();
    this.buttons = false;
    this.collector.stop();
  }

  // Create a collector to listen for reactions to the message
  createCollector() {
    this.collector = this.src.createReactionCollector((reaction, user) => {
      return validReactions.includes(reaction.emoji.name) && !user.bot;
    });
    this.collector.on('collect', (reaction) => {
      this.emit('reaction', reaction.emoji.name);
    })
  }

  delete() {
    if (this.collector) this.collector.stop();
    if (this.src) this.src.delete();
  }
}

module.exports = PlayCard;
