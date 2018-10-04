'use strict'

import { expect } from 'chai';
import * as _ from 'lodash';
import 'mocha';
import { SoundCloudAPI } from '../../../src/libs/api/SoundCloudAPI';
import { loadConfig } from '../../../src/libs/common/Utils';
import { SCUser } from '../../../src/typings/index';



const config = loadConfig();
let scApi: SoundCloudAPI;

const userUrl = 'https://soundcloud.com/jack-belford-1';
const trackUrl = 'https://soundcloud.com/jack-belford-1/edm-mix-midnight-of-solace';
const playlistUrl = 'https://soundcloud.com/jack-belford-1/sets/bot-test-playlist';

describe('SoundCloudAPI', () => {

  beforeEach(() => {
    scApi = new SoundCloudAPI(config.tokens.soundcloud);
  });

  describe('#parseUrl()', () => {

    it('Non-soundcloud url returns null', () => {
      expect(scApi.parseUrl('djfksldskj')).to.be.null;
    });

    it('Valid soundcloud url returns url', () => {
      expect(scApi.parseUrl(userUrl)).to.equal(userUrl);
      expect(scApi.parseUrl(trackUrl)).to.equal(trackUrl);
      expect(scApi.parseUrl(playlistUrl)).to.equal(playlistUrl);
    });

  });

  describe('#getTracks()', () => {

    it('Returns empty list if nothing parsed', async () => {
      expect(await scApi.getTracks()).to.be.an('array').that.is.empty;
    });

    it('Not track nor playlist url throws error', (done) => {
      scApi.parseUrl(userUrl);
      scApi.getTracks().then(() => done(`didn't throw error`), () => done());
    });

    it('Get track', async () => {
      scApi.parseUrl(trackUrl);
      const tracks = await scApi.getTracks();
      expect(tracks).to.be.an('array').with.length(1);
      expect(tracks[0].url).to.have.length.greaterThan(0);
    });

    it('Get playlist', async () => {
      scApi.parseUrl(playlistUrl);
      const tracks = await scApi.getTracks();
      expect(tracks).to.be.an('array').with.length.above(0);
      expect(tracks.some(x => _.isNil(x.url) || x.url.length === 0)).to.be.false;
    });

  });

  describe('#getUserInfo()', () => {

    it('bad permalink throws', (done) => {
      scApi.getUserInfo('&/&bad?').then(() => done(`didn't throw error`), () => done());
    });

    it('Gets users info', async () => {
      const permalink = 'jack-belford-1';
      const info = await scApi.getUserInfo(permalink);
      expect(info.permalink).to.equal(permalink);
    });

  });

  describe('#downloadFavorites()', () => {

    it('bad input throws', (done) => {
      scApi.downloadFavorites({ id: '^$#&*?' } as any).then(() => done(`didn't throw error`), () => done());
    });

    it('Gets favorites', async () => {
      const permalink = 'phantasmusa';
      const id = '201554854';
      const scUser: SCUser = {
        id: 201554854,
        permalink: 'phantasmusa',
        username: 'Phantasm',
        favorites: 120,
        guilds: [],
        list: []
      }

      const user = await scApi.downloadFavorites(scUser);
      expect(user.list).is.an('array').with.length.above(0);
      expect(user.list.some(x => _.isNil(x.url) || x.url.length === 0)).to.be.false;
    });

  });

});