"use strict"

import * as request from 'request';
import { Readable } from "stream";
import * as ytdl from 'ytdl-core';
import { Users } from "../../models/Users";
import { BotConfig, SpotifyTrack, Track } from "../../typings/index";
import { YoutubeAPI } from "../api/YoutubeAPI";


export class StreamService {

  private ytApi: YoutubeAPI;

  constructor(private users: Users, private config: BotConfig) {
    this.ytApi = new YoutubeAPI(config.tokens.youtube);
  }

  public getTrackStream(track: Track, cb: (stream: Readable) => void) {
    if (track.src === 'sc') return cb(request(`${track.url}?client_id=${this.config.tokens.soundcloud}`) as any);
    else if (track.src === 'spot' && !(track as SpotifyTrack).loaded) {
      return this.loadAndUpdateTrack(track as SpotifyTrack).then( (newTrack) => {
        cb(ytdl(newTrack.url, { filter : 'audioonly' }).on('error', (err) => console.log(err)));
      });
    }
    return cb(ytdl(track.url, { filter : 'audioonly' })
        .on('error', (err) => console.log(err)));
  }

  private async loadAndUpdateTrack(track: SpotifyTrack) {
    const youtubeTracks = await this.ytApi.searchForVideo(`${track.title} ${track.poster}`);
    track.url = youtubeTracks[0].url;
    track.loaded = true;
    await this.users.updateAllUsersSpotifyTrack(track);
    return track;
  }
}