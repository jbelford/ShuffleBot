import * as co from 'co';
import * as request from 'request';
import { Message, EmojiIdentifierResolvable } from 'discord.js';

export function shuffleList<T>(list: T[]) {
  for (let i = 0; i < list.length; i++) {
    const rand = Math.floor(Math.random() * list.length);
    const temp = list[rand];
    list[rand] = list[i];
    list[i] = temp;
  }
  return list;
}

export function sleep(millis: number) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(true);
    }, millis);
  });
}

export const reactSequential: (message: Message, emojis: EmojiIdentifierResolvable[]) => Promise<{}> = 
    co.wrap(function* (message: Message, emojis: EmojiIdentifierResolvable[]) {
  for (const i in emojis) yield message.react(emojis[i]);
});

export function requestPromise(uri: string, options?: request.CoreOptions): Promise<request.RequestResponse> {
  return new Promise((resolve, reject) => {
    request(uri, options, (error: any, response: request.RequestResponse, body: any) => {
      if (error) return reject(error);
      return resolve(response);
    });
  });
}

