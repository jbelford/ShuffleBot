"use strict"

import * as _ from 'lodash';

import { Db, Collection } from 'mongodb';
import { Cache } from '../libs/data/cache';
import { BotConfig } from '../typings';

export class Guilds {

  private collectionName: string = 'Guilds';
  private collection: Collection;
  private scLim: number;
  private scInterval: number;

  constructor(db: Db, private cache: Cache, config: BotConfig) {
    this.collection = db.collection(this.collectionName);
    this.scLim = config.sc.limit;
    this.scInterval = config.sc.interval * 1000 * 60 * 60;
  }

  *canDownload(guildId: string) {
    const doc = yield this.collection.findOne({ guildId: guildId });
    if (_.isNil(doc)) return true;
    const regen = Math.floor((Date.now() - doc.scdl.timestamp) / this.scInterval);
    if (regen > 0) this.collection.update({ _id: doc._id }, { $set: { "scdl.num": Math.max(doc.scdl.num - regen, 0) } });
    return doc.scdl.num - regen < this.scLim;
  }

  updateDownload(guildId: string) {
    return this.collection.updateOne({ guildId: guildId }, { $set: { "scdl.timestamp": Date.now() }, $inc: { "scdl.num": 1 } }, { upsert: true });
  }
}