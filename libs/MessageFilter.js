"use strict"

const _ = require("lodash");
const spammers = [];


class MessageFilter {
  constructor(filterOptions) {
    this.exclude = filterOptions.exclude;
    this.spam = filterOptions.spam;
    this.allegedly = filterOptions.allegedly;
  }

  filterMessage(message) {
    if (this.exclude.includes(message.channel.id)) return;
    if (!_.isNil(this.spam)) resolveSpam(message, this.spam);
    if (!_.isNil(this.allegedly)) resolveAllegedly(message, this.allegedly);
  }
}

function resolveSpam(message, spamOptions) {
  const newTimestamp = Date.now();
  const authorID = message.author.id;
  const spammer = spammers.find(spammer => spammer.id === authorID);
  if (_.isNil(spammer)) {
    const idx = spammers.length - 1;
    setTimeout( () => {
      spammers.splice(idx, 1);
    }, spamOptions.period * 1000);
    return spammers.push({ "id" : authorID, "count" : 1, "timestamp" : newTimestamp, "warned" : false });
  }
  const idx = spammers.indexOf(spammer);
  if (++spammers[idx].count > spamOptions.limit) {
    message.delete();
    if (!spammer.warned) {
      message.reply(`You may only send ${spamOptions.limit} messages in a ${spamOptions.period} second interval`);
      spammers[idx].warned = true;
    }
  }
}

function resolveAllegedly(message, chance) {
  if (Math.random() <= chance) {
    message.channel.send("*_Allegedly..._*");
  }
}

module.exports = MessageFilter;
