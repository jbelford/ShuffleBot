"use strict"

import { Firestore } from '@google-cloud/firestore';
import * as _ from 'lodash';
import { Cache } from '../libs/data/Cache';
import { FirestoreGuildsCollection, GuildsCollection } from '../libs/data/db';
import { BotConfig } from '../typings';


export class Guilds {

  private collection: GuildsCollection;
  private scLim: number;
  private scInterval: number;

  constructor(db: Firestore, private cache: Cache, config: BotConfig) {
    this.collection = new FirestoreGuildsCollection(db);
    this.scLim = config.sc.limit;
    this.scInterval = config.sc.interval * 1000 * 60 * 60;
  }

  public async canDownload(guildId: string) {
    const guild = await this.collection.get(guildId);
    if (_.isNil(guild)) return true;
    const regen = Math.floor((Date.now() - guild.scdl.timestamp) / this.scInterval);
    if (regen > 0) {
      guild.scdl.num = Math.max(guild.scdl.num - regen, 0);
      await this.collection.set(guildId, guild);
    }
    return guild.scdl.num - regen < this.scLim;
  }

  public updateDownload(guildId: string) {
    this.collection.incrementScdl(guildId);
  }
}