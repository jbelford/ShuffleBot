"use strict"

import { Db }          from 'mongodb';
import { Cache }       from '../libs/data/Cache';
import { QueuePlayer } from '../libs/QueuePlayer';
import { BotConfig }   from '../typings';

export class QueuePlayerManager {

  private ttl: number = 1000 * 60 * 60;
  private cache: Cache;
  private scToken: string;

  constructor(db: Db, cache: Cache, config: BotConfig) {
    this.cache = cache;
    this.scToken = config.tokens.soundcloud;
  }

  public get(guildId): QueuePlayer {
    const cacheId = `QueuePlayer:${guildId}`;
    if (!this.cache.has(cacheId)) {
      this.cache.update(cacheId, new QueuePlayer(this.cache, cacheId, this.ttl, this.scToken), this.ttl);
    }
    return this.cache.get(cacheId);
  }
}
