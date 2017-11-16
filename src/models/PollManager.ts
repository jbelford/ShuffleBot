"use strict"

import { Db }                from 'mongodb';
import { Cache }             from '../libs/data/Cache';
import { Poll }              from '../libs/data/Poll';
import { PollOption }        from '../typings';
import { User, TextChannel } from 'discord.js';

export class PollManager {

  private ttl = 1000 * 60 * 60 * 3;
  
  constructor(db: Db, private cache: Cache) {
  }

  public async createPoll(channel: TextChannel, user: User, question: string, options: PollOption[]) {
    const cacheId = `Poll:${user.id}`;
    if (!this.cache.has(cacheId) || !this.cache.get(cacheId).active) {
      const poll = new Poll(question, options, user);
      this.cache.update(cacheId, poll, this.ttl);
      await poll.send(channel);
      return true;
    }
    return false;
  }
}