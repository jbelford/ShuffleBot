"use strict"

import * as _           from 'lodash';
import * as querystring from 'querystring';

import { RequestResponse } from 'request';
import { requestPromise }  from '../common/Utils';
import { Track }           from '../../typings';

export class YoutubeAPI {

  private YT_API = "https://www.googleapis.com/youtube/v3";
  private url: string;
  private parseData: string[];

  constructor(private key: string) {}

  parseUrl(text: string) {
    const regYT = /(^|\s)(https?:\/\/)?(www\.)?youtube\.com\/(watch|playlist)\?(v|list)=([^\s&]+)[^\s]*($|\s)/g;
    const match = regYT.exec(text);
    if (!_.isNil(match)) {
      this.parseData = match.splice(5, 2);
      this.url = match[0];
      return this.url;
    }
  }

  *getVideos() {
    if (_.isNil(this.parseData)) return [];
    const type = this.parseData[0] === 'v' ? 1 : 0;
    const scope = { "get" : ["playlistItems", "videos"], "id" : ["playlistId", "id"], "xtra" : ["&maxResults=50", ""] };
    const base = `${this.YT_API}/${scope.get[type]}?part=snippet&${scope.id[type]}=${this.parseData[1]}${scope.xtra[type]}&key=${this.key}`;
    const collected: Track[] = [];
    let link = base;
    while (link) {
      const resp: RequestResponse = yield requestPromise(link);
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

  *searchForVideo(searchTerms: string) {
    const query = querystring.stringify({ q : searchTerms });
    const resp = yield requestPromise(`${this.YT_API}/search?part=snippet&${query}&maxResults=1&type=video&key=${this.key}`);
    if (resp.statusCode !== 200) throw new Error(`Code: ${resp.statusCode}`);
    const data = JSON.parse(resp.body).items[0];
    if (_.isNil(data)) throw new Error('No songs fit that query');
    const artwork = _.isNil(data.snippet.thumbnails) ? 'http://beatmakerleague.com/images/No_Album_Art.png' :
                      data.snippet.thumbnails.high.url;
    return {
        "title"  : data.snippet.title,
        "url"    : `https://www.youtube.com/watch?v=${data.id.videoId}`,
        "poster" : data.snippet.channelTitle,
        "pic"    : artwork,
        "src"    : "yt"
    };
  }
}
