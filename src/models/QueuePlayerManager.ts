"use strict"

import { Db }          from 'mongodb';
import { Cache }       from '../libs/data/Cache';
import { QueuePlayer } from '../libs/QueuePlayer';
import { BotConfig }   from '../typings';
import { StreamService } from '../libs/services/StreamService';
import { Users } from './Users';

export class QueuePlayerManager {

  private ttl: number = 1000 * 60 * 60;
  private cache: Cache;
  private streamService: StreamService;

  constructor(db: Db, cache: Cache, private config: BotConfig) {
    this.cache = cache;
    this.streamService = new StreamService(new Users(db, cache, config), config);
  }

  public get(guildId): QueuePlayer {
    const cacheId = `QueuePlayer:${guildId}`;
    if (!this.cache.has(cacheId)) {
      this.cache.update(cacheId, new QueuePlayer(this.cache, cacheId, this.ttl, this.streamService), this.ttl);
    }
    return this.cache.get(cacheId);
  }

  public leaveAll() {
    this.cache.getAll(/^QueuePlayer:\d+$/g).forEach( value => {
      const queuePlayer: QueuePlayer = value.item;
      queuePlayer.close(`Closing music stream by request of administrator. This was likely done due to heavy server load. Sorry about that.`);
    });
  }
}
