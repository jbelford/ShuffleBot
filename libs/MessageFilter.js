"use strict"

const _ = require("lodash");
const spammers = {};


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
  const chanID = message.channel.id;
  if (_.isNil(spammers[chanID])) {
    spammers[chanID] = {};
  }
  if (_.isNil(spammers[chanID][authorID])) {
    spammers[chanID][authorID] = { "count" : 1, "timestamp" : newTimestamp };
    setTimeout( () => {
      delete spammers[chanID][authorID];
    }, spamOptions.period * 1000);
  } else if (++spammers[chanID][authorID].count > spamOptions.limit) {
    message.reply(`You may only send ${spamOptions.limit} messages in a ${spamOptions.period} second interval`);
    message.channel.overwritePermissions(authorID, { "SEND_MESSAGES" : false });
    setTimeout( () => {
      message.channel.overwritePermissions(authorID, { "SEND_MESSAGES" : true });
    }, spamOptions.period * 1000 + spammers[chanID][authorID].timestamp - newTimestamp);
  }
}

function resolveAllegedly(message, chance) {
  if (Math.random() <= chance) {
    message.channel.send("*_Allegedly..._*");
  }
}

module.exports = MessageFilter;
