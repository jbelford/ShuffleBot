"use strict"

const wrap    = require('co-express');
const Discord = require('discord.js');
const client  = new Discord.Client();

// Listens for the parent process to send information
process.on('message', wrap( function* (data) {
  if (data.type === "start") return yield client.login(data.token);
  if (data.type === "stop") return;
  const update = yield listenForUpdates(client.channels.get(data.chanID), data.msgID);
  if (update) process.send({ emoji : update.emoji.toString() });
}));

// Pings discord every so often to check if any of the buttons have been pressed.
// If we receive another message this loop will close.
function* listenForUpdates(channel, msgID) {
  let loop = true;
  process.on('message', data => {
    loop = false;
  })
  while (loop) {
    yield timeoutPromise(500);
    if (!loop) break;
    const message = yield channel.fetchMessage(msgID);
    const reactions = message.reactions.array();
    for (const x in reactions) {
      if (loop && reactions[x].count > 1) return reactions[x];
    }
  }
  return false;
}

// Timeout that returns a promise so I can yield
function timeoutPromise(time) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(true);
    }, time);
  });
}
