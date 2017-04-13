"use strict"

const _           = require('lodash');
const wrap        = require('co-express');
const request     = require('co-request');
const nodeCleanup = require('node-cleanup');
const API         = "https://discordapp.com/api";

let chanID = null;
let msgID  = null;
let token;

// Listens for the parent process to send information
process.on('message', wrap( function* (data) {
  if (data.type === "start") {
    token = data.token;
    return;
  }
  chanID = data.chanID;
  msgID  = data.msgID;
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
      const message = yield request({
        uri : `${API}/channels/${localChan}/messages/${localMsg}`,
        headers : { "Authorization" : `Bot ${token}` }
      });
      const reactions = JSON.parse(message.body).reactions;
      for (const x in reactions) {
        if (reactions[x].count > 1) {
          process.send({ emoji : reactions[x].emoji.name });
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
