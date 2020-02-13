"use strict"

import { Firestore } from '@google-cloud/firestore';
import * as _ from 'lodash';
import { Cache } from '../libs/data/Cache';
import { FirestorePlaylistToUserCollection, FirestoreUsersCollection, PlaylistToUserCollection, UsersCollection } from '../libs/data/db';
import { BotConfig, GuildUser, Track } from '../typings';

export class Users {

  private users: UsersCollection;
  private playlistsToUsers: PlaylistToUserCollection;

  constructor(db: Firestore, private cache: Cache, config: BotConfig) {
    this.users = new FirestoreUsersCollection(db);
    this.playlistsToUsers = new FirestorePlaylistToUserCollection(db);
  }

  public getList(members: string[]): Promise<GuildUser[]> {
    return this.users.findIn(members);
  }

  public async getUser(userId: string) {
    const cacheId = `User:${userId}`;
    let user: GuildUser;
    if (!this.cache.has(cacheId)) {
      user = await this.users.get(userId);
      if (user) {
        this.cache.update(cacheId, user);
      } else {
        user = this.newUser(userId);
      }
    } else {
      user = this.cache.get(cacheId);
    }
    return user;
  }

  public async getUserFromPlaylistId(plId: string) {
    const item = await this.playlistsToUsers.get(plId);
    if (_.isNil(item)) return null;
    return await this.getUser(item.user);
  }

  public async newPlaylist(userId: string, plId: string, name: string) {
    let exists = await this.playlistsToUsers.get(plId);
    if (exists)
      return `The ID \`${plId}\` is already in use! Try a different one!`;

    await this.playlistsToUsers.set(plId, { user: userId });
    const user = await this.users.addPlaylist(userId, name, plId);
    this.updateUserCache(userId, user);
  }

  public async deletePlaylist(userId: string, plId: string) {
    let user = await this.getUser(userId);
    if (!user.playlists.some(x => x.key === plId))
      return `You have no playlist identified by \`${plId}\``;

    await this.playlistsToUsers.remove(plId);
    user = await this.users.deletePlaylist(userId, plId);
    this.updateUserCache(userId, user);
  }

  public async addToPlaylist(userId: string, plId: string, tracks: Track[]): Promise<string | undefined> {
    try {
      const user = await this.users.addToPlaylist(userId, plId, tracks);
      this.updateUserCache(userId, user);
    } catch (e) {
      console.log(e);
      return `You have no playlist identified by \`${plId}\``;
    }
  }

  public async removeFromPlaylist(userId: string, plId: string, idx1: number, idx2?: number) {
    let user = await this.getUser(userId);
    if (!user.playlists.some(x => x.key === plId))
      return `You have no playlist identified by \`${plId}\``;

    const playlist = user.playlists.find(x => x.key === plId);
    const lengthPrior = playlist.list.length;
    if (_.isNil(idx2)) playlist.list.splice(idx1, 1);
    else if (idx2 === 0) playlist.list.splice(idx1, playlist.list.length - idx1);
    else playlist.list.splice(idx1, (idx2 < 0 ? playlist.list.length + idx2 : idx2) - idx1);
    playlist.size = playlist.list.length;
    if (playlist.size === lengthPrior)
      return `Query resulted in no tracks being removed!`;

    await this.users.set(userId, user);
    this.updateUserCache(userId, user);
  }

  private newUser(userId: string): GuildUser {
    return { userId: userId, playlists: []};
  }

  private updateUserCache(userId: string, user: GuildUser) {
    this.cache.update(`User:${userId}`, user);
  }
}