"use strict"

const _       = require('lodash');
const wrap    = require('co-express');
const Discord = require('discord.js');
const client  = new Discord.Client();

let chanID = null;
let msgID = null;

// Listens for the parent process to send information
process.on('message', wrap( function* (data) {
  if (data.type === "start") return yield client.login(data.token);
  if (data.type === "stop") {
    chanID = null; msgID = null;
  }
  chanID = data.chanID;
  msgID = data.msgID;
}));

// Timeout that returns a promise so I can yield
function timeoutPromise(time) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(true);
    }, time);
  });
}

wrap( function* listenForUpdates() {
  while (1) {
    const localChan = chanID;
    const localMsg = msgID;
    yield timeoutPromise(500);
    if (_.isNil(localChan) || _.isNil(localMsg)) continue;
    try {
      const message = yield client.channels.get(localChan).fetchMessage(localMsg);
      const reactions = message.reactions.array();
      for (const x in reactions) {
        if (reactions[x].count > 1) {
          process.send({ emoji : reactions[x].emoji.toString() });
          chanID = null;
          msgID = null;
          break;
        }
      }
    } catch (e) {
      continue;
    }
  }
})();
