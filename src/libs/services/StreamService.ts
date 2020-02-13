"use strict"

import request from 'request';
import { Readable } from "stream";
import ytdl from 'ytdl-core';
import { BotConfig, SpotifyTrack, Track } from "../../typings/index";
import { YoutubeAPI } from "../api/YoutubeAPI";
import { SearchCollection } from '../data/db';


export class StreamService {

  private ytApi: YoutubeAPI;

  constructor(private users: SearchCollection, private config: BotConfig) {
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

  private async loadAndUpdateTrack(track: SpotifyTrack): Promise<Track> {
    const search = `${track.title} ${track.poster}`;
    const result = await this.users.get(search);
    if (result) {
      return result;
    }

    const youtubeTracks = await this.ytApi.searchForVideo(search);
    track.url = youtubeTracks[0].url;
    track.loaded = true;
    this.users.set(search, track);
    return track;
  }
}