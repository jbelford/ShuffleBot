"use strict"

import { EventEmitter } from 'events';
import * as _ from 'lodash';
import { Collection, Db } from 'mongodb';
import { SoundCloudAPI } from '../libs/api/SoundCloudAPI';
import { Cache } from '../libs/data/Cache';
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

  public async addUser(user_permalink: string, timestamp: number, guildId: string): Promise<Error> {
    try {
      const info = await this.scApi.getUserInfo(user_permalink);
      if (_.isNil(info.public_favorites_count) || info.public_favorites_count === 0)
        throw new Error("That user has no favorites!");

      this.emit(`start ${timestamp}`, info);
      const user_info = await this.scApi.downloadFavorites({
        "permalink": info.permalink,
        "username": info.username,
        "id": info.id,
        "guilds": [guildId],
        "favorites": info.public_favorites_count,
        "list": []
      }, this, `progress ${timestamp}`);

      let doc = {};
      const cachedId = `${this.collectionName}:${user_info.permalink}`;
      if (this.cache.needsUpdate(cachedId, user_info)) {
        this.cache.update(cachedId, user_info);
        delete user_info.guilds;
        doc = await this.collection.updateOne({ permalink: user_info.permalink }, { $addToSet: { guilds: guildId }, $set: user_info }, { upsert: true });
        this.cache.removeIf(`${this.collectionName}:${guildId}`);
      } else {
        doc = this.cache.get(cachedId);
      }

      this.emit(`complete ${timestamp}`, user_info, doc);
    } catch (e) {
      return e;
    }
  }

  public async listUsers(guildId: string) {
    const cachedId = `${this.collectionName}:${guildId}`;
    if (this.cache.has(cachedId)) return this.cache.get(cachedId) as SCUser[];
    const userList: SCUser[] = await this.collection.find({ guilds: { $elemMatch: { $eq: guildId } } }).toArray() as any;
    this.cache.update(cachedId, userList);
    return userList;
  }

  public async getUser(user_permalink: string) {
    const cachedId = `${this.collectionName}:${user_permalink}`;
    if (this.cache.has(cachedId)) return this.cache.get(cachedId) as SCUser;
    const user: SCUser = await this.collection.findOne({ permalink: user_permalink }) as any;
    this.cache.update(cachedId, user);
    return user;
  }

  public async removeUser(userquery: string, guildId: string) {
    const cachedId = `${this.collectionName}:${guildId}`;
    if (this.cache.has(cachedId) && this.cache.get(cachedId).every((user: SCUser) => user.permalink !== userquery && user.username !== userquery)) {
      return false;
    }
    const doc = await this.collection.findOneAndUpdate({ $or: [{ permalink: userquery }, { username: userquery }] }, { $pullAll: { guilds: [guildId] } });
    if (doc.lastErrorObject.updatedExisting) {
      if (doc.value.guilds.length === 1) this.collection.deleteOne({ _id: doc.value._id });
      this.cache.removeIf(cachedId);
      return true;
    }
    return false;
  }
}