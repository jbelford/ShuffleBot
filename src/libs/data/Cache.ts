"use strict"

import * as _ from 'lodash';

const DEFAULT_TTL = 1000 * 60 * 30;
const SWEEP_TIME = 1000 * 60 * 10;

export class Cache {
  
  private cache: { [key: string]: { item: any, ttl: number } } = {};

  constructor() {
    setInterval(() => this.sweep(), SWEEP_TIME);
  }

  public sweep() {
    const now = Date.now();
    _.forEach(this.cache, (doc, id) => {
      if (doc.ttl < now) {
        if (typeof doc.item.close === "function")
          this.cache[id].item.close();
        delete this.cache[id];
      }
    });
  }

  public has(id: string) {
    return !_.isNil(this.cache[id]) && this.cache[id].ttl > Date.now();
  }

  public get(id: string) {
    return this.cache[id].item;
  }

  public getAll(reg: RegExp) {
    return _.filter(this.cache, (value, key) => !_.isNil(key.match(reg)));
  }

  public removeIf(id: string) {
    if (this.has(id)) {
      delete this.cache[id];
    }
  }

  public needsUpdate(id: string, doc: any) {
    return !this.has(id) || JSON.stringify(doc) !== JSON.stringify(this.get(id));
  }

  public update(id: string, doc: any, ttl?: number) {
    this.cache[id] = {
      item : doc,
      ttl  : Date.now() + (_.isNil(ttl) ? DEFAULT_TTL : ttl)
    };
  }

  public refresh(id: string, ttl: number) {
    this.cache[id].ttl = Date.now() + (_.isNil(ttl) ? DEFAULT_TTL : ttl);
  }
}
