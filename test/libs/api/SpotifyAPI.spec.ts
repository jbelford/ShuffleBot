"use strict"

import { expect } from 'chai';
import 'mocha';
import * as sinon from 'sinon';
import * as SpotifyWebAPI from 'spotify-web-api-node';
import { SpotifyAPI } from '../../../src/libs/api/SpotifyAPI';
import { loadConfig } from '../../../src/libs/common/Utils';



const config = loadConfig();
const spotApi = new SpotifyAPI(config.tokens.spotify.clientId, config.tokens.spotify.clientSecret);

describe('SpotifyAPI', () => {

  describe('#getPlaylist', () => {

    it('bad input returns null', async () => {
      expect(await spotApi.getPlaylist('@#*(@)(')).to.be.null;
    });

    it('Gets playlist', async () => {
      const getPlayStub = sinon.stub(SpotifyWebAPI.prototype, 'getPlaylist')
        .returns({
          body: {
            name: 'test',
            tracks: { total: 1, items: [] },
            images: [{ url: 'exampleUrl' }]
          }
        });
      const getTracks = sinon.stub(SpotifyWebAPI.prototype, 'getPlaylistTracks')
        .returns({
          body: {
            items: [{
              track: {
                name: 'testTrack',
                uri: 'testUri',
                artists: [{ name: 'testArtist' }],
                album: { images: [{ url: 'imageUrl' }] }
              }
            }]
          }
        });
      const cred = sinon.stub(SpotifyWebAPI.prototype, 'clientCredentialsGrant')
        .returns({ body: { access_token: 'foo' } });

      const playlist = await spotApi.getPlaylist(null);
      expect(playlist.name).to.equal('test');
      expect(playlist.tracks).to.be.an('array').with.length(1);
      expect(playlist.tracks[0].title).to.equal('testTrack');

      getPlayStub.restore();
      getTracks.restore();
      cred.restore();
    });

  });

});