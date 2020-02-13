"use strict"

import { Firestore } from '@google-cloud/firestore';
import * as commands from './commands';
import { loadConfig } from './libs/common/Utils';
import { Cache } from './libs/data/Cache';
import { DiscordBot } from './libs/DiscordBot';
import * as models from './models';
import { BotConfig } from './typings';


async function startBot(config: BotConfig) {
  try {
    const bot = new DiscordBot(config);
    // Connect database
    const db = new Firestore();
    const cache = new Cache();
    // Setup DAOs
    const daos = {};
    Object.keys(models).forEach(key => daos[key] = new models[key](db, cache, config));
    // Add command handlers
    Object.keys(commands).forEach(key => commands[key](bot, config, daos));
    // Start the bot
    await bot.login();
  } catch (e) {
    console.log(e);
  }
}

startBot(loadConfig());
