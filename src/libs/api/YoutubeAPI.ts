"use strict"

import * as _           from 'lodash';
import * as querystring from 'querystring';

import { requestPromise }  from '../common/Utils';
import { Track }           from '../../typings';

export class YoutubeAPI {

  private YT_API = "https://www.googleapis.com/youtube/v3";
  private parseData: string[];

  constructor(private key: string) {}

  public parseUrl(text: string) {
    const regYT = /(^|\s)(https?:\/\/)?(www\.)?youtube\.com\/(watch|playlist)\?(v|list)=([^\s&]+)[^\s]*($|\s)/g;
    const match = regYT.exec(text);
    if (_.isNil(match)) {
      this.parseData = null;
      return null;
    }
    this.parseData = match.splice(5, 2);
    return match[0];
  }

  public async getVideos() {
    if (_.isNil(this.parseData)) return [];
    const type = this.parseData[0] === 'v' ? 1 : 0;
    const scope = { "get" : ["playlistItems", "videos"], "id" : ["playlistId", "id"], "xtra" : ["&maxResults=50", ""] };
    const base = `${this.YT_API}/${scope.get[type]}?part=snippet&${scope.id[type]}=${this.parseData[1]}${scope.xtra[type]}&key=${this.key}`;
    const collected: Track[] = [];
    let link = base;
    while (link) {
      const resp = await requestPromise(link);
      if (resp.statusCode !== 200) throw new Error(`Code: ${resp.statusCode}`);
      const data = JSON.parse(resp.body);
      link = !_.isNil(data.nextPageToken) ? `${base}&pageToken=${data.nextPageToken}` : null;
      _.forEach(data.items, (song: any) => {
        const artwork = _.isNil(song.snippet.thumbnails) ? 'http://beatmakerleague.com/images/No_Album_Art.png' :
                          song.snippet.thumbnails.high.url;
        const id = type ? song.id : song.snippet.resourceId.videoId;
        collected.push({
          "title"  : song.snippet.title,
          "url"    : `https://www.youtube.com/watch?v=${id}`,
          "poster" : song.snippet.channelTitle,
          "pic"    : artwork,
          "src"    : "yt"
        });
      });
    }
    return collected;
  }

  public async searchForVideo(searchTerms: string, maxResults?: number) {
    const query = querystring.stringify({
      part : 'snippet',
      q : searchTerms,
      maxResults : _.isNil(maxResults) ? 5 : maxResults,
      type : 'video',
      key : this.key
    });
    const resp = await requestPromise(`${this.YT_API}/search?${query}`);
    if (resp.statusCode !== 200) throw new Error(`Code: ${resp.statusCode}`);
    const items = JSON.parse(resp.body).items;
    if (_.isNil(items) || items.length === 0) throw new Error('No songs fit that query');
    return items.map( item => {
      const artwork = _.isNil(item.snippet.thumbnails) ? 'http://beatmakerleague.com/images/No_Album_Art.png' :
            item.snippet.thumbnails.high.url;
      return {
      "title"  : item.snippet.title,
      "url"    : `https://www.youtube.com/watch?v=${item.id.videoId}`,
      "poster" : item.snippet.channelTitle,
      "pic"    : artwork,
      "src"    : "yt"
      };
    }) as Track[];
  }
}
