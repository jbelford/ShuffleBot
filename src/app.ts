"use strict"

import * as co from 'co';
import * as fs from 'fs';

import { MongoClient, Db } from 'mongodb';
import { BotConfig }       from './typings';
import { DiscordBot }      from './libs/DiscordBot';
import { Cache }           from './libs/data/Cache';

import * as models      from './models';
import * as commands    from './commands';

function* startBot(config: BotConfig) {
  try {
    const bot = new DiscordBot(config);
    // Connect database
    const db: Db = yield MongoClient.connect(config.dbUrl);
    const cache = new Cache();
    // Setup DAOs
    const daos = {};
    Object.keys(models).forEach(key => daos[key] = new models[key](db, cache, config));
    // Add command handlers
    Object.keys(commands).forEach(key => commands[key](bot, config, daos));
    // Start the bot
    yield bot.login();
  } catch (e) {
    console.log(e);
  }
}

const config = JSON.parse(fs.readFileSync('./config/config.json', 'utf8'));
config.commands = JSON.parse(fs.readFileSync('./config/commands.json', 'utf8'));
co(startBot(config));
