"use strict"

import * as SpotifyWebAPI from 'spotify-web-api-node';
import { SpotifyTrack } from '../../typings/index';

export class SpotifyAPI {

  private spotifyApi: SpotifyWebAPI;
  private expiration: number = 0;

  constructor(clientId: string, clientSecret: string) {
    this.spotifyApi = new SpotifyWebAPI({
      clientId: clientId,
      clientSecret: clientSecret
    });
  }

  public async getPlaylist(playlistId: string): Promise<{ name: string, tracks: SpotifyTrack[] }> {
    try {
      await this.checkAndUpdateToken();
      let data = await this.spotifyApi.getPlaylist(playlistId);
      const name = data.body.name;
      let total = data.body.tracks.total;
      let defaultArt = data.body.images.length ? data.body.images[0].url : 'http://beatmakerleague.com/images/No_Album_Art.png';
      let items = data.body.tracks.items;
      while (items.length < total) {
        await this.checkAndUpdateToken();
        data = await this.spotifyApi.getPlaylistTracks(playlistId, { offset: items.length, limit: 100 });
        items = items.concat(data.body.items);
      }
      return {
        name: name,
        tracks: items.map(item => ({
          title: item.track.name,
          url: '',
          poster: item.track.artists.map(x => x.name).join(', '),
          pic: item.track.album.images.length ? item.track.album.images[0].url : defaultArt,
          src: 'spot',
          loaded: false,
          trackId: item.track.uri
        }))
      };
    } catch (e) {
      return null;
    }
  }

  private async checkAndUpdateToken() {
    if (Date.now() + 5000 > this.expiration) {
      const data = await this.spotifyApi.clientCredentialsGrant();
      this.spotifyApi.setAccessToken(data.body.access_token);
    }
  }
}