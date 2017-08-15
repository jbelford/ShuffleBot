"use strict"

import * as Utils from '../common/Utils';

export class Queue<T> {

  private list: T[];

  constructor() {
    this.list = [];
  }

  public size() {
    return this.list.length;
  }

  public peek() {
    return this.list.length > 0 ? this.list[0] : null;
  }

  public clear() {
    this.list = [];
  }

  public push(items: T[], top: boolean) {
    this.list = top ? items.concat(this.list) : this.list.concat(items);
  }

  public pop() {
    return this.list.shift();
  }

  public shuffle() {
    this.list = Utils.shuffleList(this.list);
  }

  public get(num: number) {
    return this.list.slice(0, Math.min(num, this.size()));
  }
}
