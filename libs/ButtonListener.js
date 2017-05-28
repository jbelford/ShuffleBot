"use strict"

const _              = require('lodash');
const wrap           = require('co-express');
const request        = require('co-request');
const nodeCleanup    = require('node-cleanup');
const timeoutPromise = require('./Misc.js').timeoutPromise;
const API            = "https://discordapp.com/api";

let chanID = null;
let msgID  = null;
let wait   = true;
let token;

// Listens for the parent process to send information
process.on('message', wrap( function* (data) {
  if (data.type === "start") {
    token = data.token;
  } else if (data.type === "continue") {
    wait = false;
  } else {
    chanID = data.chanID;
    msgID  = data.msgID;
    wait = false;
  }
}));

wrap( function* listenForUpdates() {
  while (1) {
    yield timeoutPromise(500);
    if (wait) continue;
    const localChan = chanID;
    const localMsg = msgID;
    try {
      const message = yield request({
        uri : `${API}/channels/${localChan}/messages/${localMsg}`,
        headers : { "Authorization" : `Bot ${token}` }
      });
      const reactions = JSON.parse(message.body).reactions;
      for (const x in reactions) {
        if (reactions[x].count > 1) {
          process.send({ emoji : reactions[x].emoji.name });
          wait = true;
          break;
        }
      }
    } catch (e) {
      continue;
    }
  }
})();
