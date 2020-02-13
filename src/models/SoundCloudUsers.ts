"use strict"

import { Firestore } from '@google-cloud/firestore';
import { EventEmitter } from 'events';
import * as _ from 'lodash';
import { SoundCloudAPI } from '../libs/api/SoundCloudAPI';
import { Cache } from '../libs/data/Cache';
import { FirestoreSoundCloudUsersCollection, SoundCloudUsersCollection } from '../libs/data/db';
import { BotConfig, SCUser } from '../typings';


export class SoundCloudUsers extends EventEmitter {

  private collectionName: string = 'SoundCloudUsers';
  private collection: SoundCloudUsersCollection;
  private scApi: SoundCloudAPI;

  constructor(db: Firestore, private cache: Cache, config: BotConfig) {
    super();
    this.collection = new FirestoreSoundCloudUsersCollection(db);
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
        doc = await this.collection.updateAndAddGuild(user_info, guildId);
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
    const userList: SCUser[] = await this.collection.getForGuild(guildId);
    this.cache.update(cachedId, userList);
    return userList;
  }

  public async getUser(user_permalink: string) {
    const cachedId = `${this.collectionName}:${user_permalink}`;
    if (this.cache.has(cachedId)) return this.cache.get(cachedId) as SCUser;
    const user: SCUser = await this.collection.get(user_permalink);
    this.cache.update(cachedId, user);
    return user;
  }

  public async removeUser(userquery: string, guildId: string): Promise<boolean> {
    const cachedId = `${this.collectionName}:${guildId}`;
    if (this.cache.has(cachedId) && this.cache.get(cachedId).every((user: SCUser) => user.permalink !== userquery && user.username !== userquery)) {
      return false;
    }

    const existed = this.collection.removeGuild(userquery, guildId);
    if (existed) {
      this.cache.removeIf(cachedId);
    }
    return existed;
  }
}