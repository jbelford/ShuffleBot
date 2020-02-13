"use strict"

import { Firestore } from '@google-cloud/firestore';
import { Cache } from '../libs/data/Cache';
import { FirestoreSearchCollection } from '../libs/data/db';
import { QueuePlayer } from '../libs/QueuePlayer';
import { StreamService } from '../libs/services/StreamService';
import { BotConfig } from '../typings';

export class QueuePlayerManager {

  private ttl: number = 1000 * 60 * 60;
  private cache: Cache;
  private streamService: StreamService;

  constructor(db: Firestore, cache: Cache, private config: BotConfig) {
    this.cache = cache;
    this.streamService = new StreamService(new FirestoreSearchCollection(db), config);
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
