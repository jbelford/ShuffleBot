"use strict"

import 'mocha';

import { expect } from 'chai';
import { Mock, IMock, It } from 'typemoq';
import { question } from '../../../src/libs/common/Utils';
import { TextChannel, Message, MessageCollector } from 'discord.js';
import * as _ from 'lodash';

describe('Utils', () => {

  describe('#question()', () => {

    const testOptions = [{
      option: 'Test option',
      select: ['test', 'Test', 'test option', 'Test option']
    }];
    let mockChannel: IMock<TextChannel>;
    let collectorMock: IMock<MessageCollector>;
    let timeout: number;

    beforeEach( () => {
      let endCb;

      collectorMock = Mock.ofType<MessageCollector>();
      collectorMock.setup(x => x.stop()).returns(() => null);
      collectorMock.setup(x => x.on('end', It.isAny())).callback( (event, cb) => {
        endCb = cb;
      })

      mockChannel = Mock.ofType<TextChannel>();
      mockChannel.setup(x => x.send(It.isAnyString()))
        .returns(x => Promise.resolve(null));
      mockChannel.setup(x => x.createMessageCollector(It.isAny(), It.isAny()))
        .callback((filter, options) => {
          timeout = setTimeout(() => {
            if (!_.isNil(endCb)) endCb(null, 'time');
          }, options.time);
        }).returns( () => collectorMock.object);
    });

    it('Returns the index of selected option', async () => {
      for (const i in testOptions[0].select) {
        const message = Mock.ofType<Message>();
        message.setup(x => x.content).returns(() => testOptions[0].select[i]);
        collectorMock.setup(x => x.on('collect', It.isAny())).callback( (event, cb) => cb(message.object));
        const idx = await question('Test question', testOptions, 1500, 'testUser', mockChannel.object);
        expect(idx).to.equal(0);
        clearTimeout(timeout);
      }
      collectorMock.reset();
    });

    it(`Returns -1 for option that doesn't exist`, async () => {
      const message = Mock.ofType<Message>();
      message.setup(x => x.content).returns(() => 'whaat');
      collectorMock.setup(x => x.on('collect', It.isAny())).callback( (event, cb) => cb(message.object));
      const idx = await question('Test question', testOptions, 1500, 'testUser', mockChannel.object);
      expect(idx).to.equal(-1);
      clearTimeout(timeout);
      collectorMock.reset();
    });

    it('Throws error if time runs out', (done) => {
      question('Test question', testOptions, 100, 'testUser', mockChannel.object)
        .then(() => done(`Failed to throw error`), () => done());
    });

  });

});