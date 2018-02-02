"use strict"

import 'mocha';

import * as _ from 'lodash';

import { expect } from 'chai';
import { YoutubeAPI } from '../../../src/libs/api/YoutubeAPI';
import { loadConfig } from '../../../src/libs/common/Utils';

const config = loadConfig();
let ytApi: YoutubeAPI;

const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const playlistUrl = 'https://www.youtube.com/playlist?list=PLw6eTMMKY24QLYfmrU2rB8x-lP5Fas2dY';

describe('YoutubeAPI', () => {

  beforeEach(() => {
    ytApi = new YoutubeAPI(config.tokens.youtube);
  });

  describe('#parseUrl()', () => {

    it('Non-youtube url returns null', () => {
      expect(ytApi.parseUrl('www.google.ca')).to.be.null;
    });

    it('Valid youtube url returns url', () => {
      expect(ytApi.parseUrl(videoUrl)).to.equal(videoUrl);
    });

  });

  describe('#getVideos()', () => {

    it('Returns empty list if nothing parsed', async () => {
      expect(await ytApi.getVideos()).to.be.an('array').that.is.empty;
    });

    it('Gets video', async () => {
      ytApi.parseUrl(videoUrl);
      const tracks = await ytApi.getVideos();
      expect(tracks).to.be.an('array').with.length(1);
      expect(tracks.some(x => _.isNil(x.url) || x.url.length === 0)).to.be.false;
    });

    it('Gets playlist', async () => {
      ytApi.parseUrl(playlistUrl);
      const tracks = await ytApi.getVideos();
      expect(tracks).to.be.an('array').with.length.above(0);
      expect(tracks.some(x => _.isNil(x.url) || x.url.length === 0)).to.be.false;
    });

  });

  describe('#searchForVideo()', async () => {

    it('bad query throws', (done) => {
      ytApi.searchForVideo('($*)2908209384').then(() => done(`didn't throw error`), () => done());
    });

    it('Gets videos', async () => {
      const tracks = await ytApi.searchForVideo('rick roll', 3);
      expect(tracks).to.be.an('array').with.length(3);
      expect(tracks.some(x => _.isNil(x.url) || x.url.length === 0)).to.be.false;
    });

  });

});