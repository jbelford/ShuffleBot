"use strict"

import * as _ from 'lodash';

import { Db, Collection }    from 'mongodb';
import { EventEmitter }      from 'events';
import { SoundCloudAPI }     from '../libs/api/SoundCloudAPI';
import { Cache }             from '../libs/data/Cache';
import { BotConfig, SCUser } from '../typings';

export class SoundCloudUsers extends EventEmitter {

  private collectionName: string = 'SoundCloudUsers';
  private collection: Collection;
  private scApi: SoundCloudAPI;

  constructor(db: Db, private cache: Cache, config: BotConfig) {
    super();
    this.collection = db.collection(this.collectionName);
    this.scApi = new SoundCloudAPI(config.tokens.soundcloud);
  }

  public *addUser(user_permalink: string, timestamp: number, guildId: string) {
    try {
      const info = yield this.scApi.getUserInfo(user_permalink);
      if (_.isNil(info.public_favorites_count) || info.public_favorites_count === 0) 
        return "That user has no favorites!";

      this.emit(`start ${timestamp}`, info);
      const user_info: SCUser = yield this.scApi.downloadFavorites({
        "permalink" : info.permalink,
        "username"  : info.username,
        "id"        : info.id,
        "guilds"    : [guildId],
        "favorites" : info.public_favorites_count,
        "list"      : []
      }, this, `progress ${timestamp}`);

      let doc = {};
      const cachedId = `${this.collectionName}:${user_info.permalink}`;
      if (this.cache.needsUpdate(cachedId, user_info)) {
        this.cache.update(cachedId, user_info);
        delete user_info.guilds;
        doc = yield this.collection.updateOne({ permalink : user_info.permalink }, { $addToSet: { guilds: guildId }, $set: user_info }, { upsert : true });
        this.cache.removeIf(`${this.collectionName}:${guildId}`);
      } else {
        doc = this.cache.get(cachedId);
      }

      this.emit(`complete ${timestamp}`, user_info, doc);
    } catch (e) {
      return e;
    }
  }

  *listUsers(guildId: string): IterableIterator<SCUser[]> {
    const cachedId = `${this.collectionName}:${guildId}`;
    if (this.cache.has(cachedId)) return this.cache.get(cachedId);
    const userList: SCUser[] = yield this.collection.find({ guilds: { $elemMatch: { $eq: guildId }}}, { "list" : 0 }).toArray() as any;
    this.cache.update(cachedId, userList);
    return userList;
  }

  *getUser(user_permalink: string): IterableIterator<SCUser> {
    const cachedId = `${this.collectionName}:${user_permalink}`;
    if (this.cache.has(cachedId)) return this.cache.get(cachedId);
    const user: SCUser = yield this.collection.findOne({ permalink : user_permalink }) as any;
    this.cache.update(cachedId, user);
    return user;
  }
}