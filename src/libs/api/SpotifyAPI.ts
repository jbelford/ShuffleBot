"use strict"

import request from 'request';
import { SpotifyTrack } from '../../typings/index';

export class SpotifyAPI {
  private expiration: number = 0;
  private accessToken?: string;

  constructor(private readonly clientId: string, private readonly clientSecret: string) {
  }

  public async getPlaylist(playlistId: string): Promise<{ name: string, tracks: SpotifyTrack[] }> {
    try {
      await this.checkAndUpdateToken();
      const { body } = await this.get(`https://api.spotify.com/v1/playlists/${playlistId}`);
      const data = JSON.parse(body);
      const name = data.name;
      const defaultArt = data.images.length ? data.images[0].url : 'http://beatmakerleague.com/images/No_Album_Art.png';
      const items = data.tracks.items.concat(await this.getPlaylistTracks(data.tracks.next));
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
      console.log(e);
      return null;
    }
  }

  private async checkAndUpdateToken() {
    if (Date.now() + 5000 > this.expiration) {
      const data = await this.getToken();
      this.accessToken = data.access_token;
      this.expiration = Date.now() + data.expires_in;
    }
  }

  // Spoftiy web node library is SHIT
  private async getPlaylistTracks(url: string): Promise<any> {
    let items = [];

    while (url) {
      await this.checkAndUpdateToken();
      const { body } = await this.get(url);
      let data = JSON.parse(body);
      items = items.concat(data.items);
      url = data.next;
    }

    return items;
  }

  private get(url: string): Promise<any> {
    return requestP(url, { auth: { bearer: this.accessToken } });
  }

  private async getToken(): Promise<{ access_token: string, expires_in: number }> {
    let auth = (new Buffer(`${this.clientId}:${this.clientSecret}`)).toString('base64');

    const resp = await requestP('https://accounts.spotify.com/api/token',
      { method: 'post', body: 'grant_type=client_credentials', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }});

    return JSON.parse(resp.body);
  }

}

function requestP(url: string, options?: request.CoreOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    request(url, options, (err, resp) => err ? reject(err) : resolve(resp));
  });
}