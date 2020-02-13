'use strict'

import { expect } from 'chai';
import 'mocha';
import * as proxyquire from 'proxyquire';
import * as sinon from 'sinon';
import { IMock, It, Mock, Times } from 'typemoq';
import { YoutubeAPI } from '../../../src/libs/api/YoutubeAPI';
import { loadConfig } from '../../../src/libs/common/Utils';
import { Users } from '../../../src/models/Users';



const config = loadConfig();

describe('StreamService', () => {

  beforeEach( () => {
    this.request = Mock.ofType(Function);

    this.ytApiStub = sinon.stub(YoutubeAPI.prototype, 'searchForVideo');

    const injected = proxyquire('../../../src/libs/services/StreamService', {
      'ytdl-core': this.request.object,
      'request': this.request.object
    });

    this.mockUsers = Mock.ofType<Users>();
    this.streamService = new injected.StreamService(this.mockUsers.object, config);
    this.testTrack = {
      pic: '',
      poster: 'test',
      src: '',
      title: 'test',
      url: 'https://api.soundcloud.com/tracks/112780802/stream',
      trackId: 'fsjdksl'
    };
  });

  afterEach( () => {
    this.mockUsers.reset();
    this.request.reset();
    this.ytApiStub.restore();
  });

  this.validateUrl = async (expectedUrl) => {
    const requestMock: IMock<Function> = this.request;
    requestMock.setup(x => x(It.isAnyString(), It.isAny())).callback((url: string) => {
      expect(url).to.be.a('string');
      expect(url).to.equal(expectedUrl);
    });

    await this.streamService.getTrackStream(this.testTrack, () => {});
    requestMock.verify(x => x(It.isAnyString(), It.isAny()), Times.exactly(1));
  }

  describe('#getTrackStream()', () => {

    it('soundcloud track sends correctly formatted url through request', async () => {
      this.testTrack.src = 'sc';
      await this.validateUrl(`${this.testTrack.url}?client_id=${config.tokens.soundcloud}`);
    });

    it('youtube track sends correctly formatted url through ytdl', async () => {
      this.testTrack.src = 'yt';
      await this.validateUrl(this.testTrack.url);
    });

    it('loaded spotify track sends correctly formatted url through ytdl', async () => {
      this.testTrack.src = 'spot';
      this.testTrack.loaded = true;
      await this.validateUrl(this.testTrack.url);
    });

  });

  describe('#loadAndUpdateTrack()', () => {

    beforeEach(() => {
      this.testTrack.src = 'spot';
      this.testTrack.url = null;
      this.testTrack.loaded = false;

      this.expectedTrack = {
        pic: this.testTrack.pic,
        poster: this.testTrack.poster,
        src: this.testTrack.src,
        title: this.testTrack.title,
        url: 'https://api.soundcloud.com/tracks/112780802/stream',
        trackId: this.testTrack.trackId,
        loaded: 'true'
      }

      this.ytApiStub.returns(Promise.resolve([this.expectedTrack]));
    })

    it('not loaded spotify track is loaded', async () => {
      await this.validateUrl(this.expectedTrack.url);
    });

    // it('database is updated when loading', async () => {
    //   const mockUsers: IMock<Users> = this.mockUsers;
    //   mockUsers.setup(x => x.updateAllUsersSpotifyTrack(It.isAny())).callback((track: SpotifyTrack) => {
    //     assert(track.loaded);
    //     expect(track.url).to.be.equal(this.expectedTrack.url);
    //     expect(track.trackId).to.be.equal(this.expectedTrack.trackId);
    //   });

    //   await this.streamService.getTrackStream(this.testTrack, () => {});
    //   mockUsers.verify(x => x.updateAllUsersSpotifyTrack(It.isAny()), Times.exactly(1));
    // });

  });

});