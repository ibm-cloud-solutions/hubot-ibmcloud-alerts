/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

const Helper = require('hubot-test-helper');
const helper = new Helper('../src/scripts');
const expect = require('chai').expect;
const mockUtils = require('./mock.utils.cf.js');
const mockESUtils = require('./mock.utils.es.js');

const i18n = new (require('i18n-2'))({
	locales: ['en'],
	extension: '.json',
	// Add more languages to the list of locales when the files are created.
	directory: __dirname + '/../src/messages',
	defaultLocale: 'en',
	// Prevent messages file from being overwritten in error conditions (like poor JSON).
	updateFiles: false
});
// At some point we need to toggle this setting based on some user input.
i18n.setLocale('en');

// Return a promise that will be resolved in the specified # of ms.
function delay(ms) {
	return new Promise((resolve) => {
		setTimeout(function() {
			resolve();
		}, ms);
	});
}

// Passing arrow functions to mocha is discouraged: https://mochajs.org/#arrow-functions
// return promises from mocha tests rather than calling done() - http://tobyho.com/2015/12/16/mocha-with-promises/
describe('Testing problematic apps via Reg Ex', function() {

	let room;
	let cf;

	before(function() {
		mockUtils.setupMockery();
		mockESUtils.setupMockery();
		// initialize cf, hubot-test-helper doesn't test Middleware
		cf = require('hubot-cf-convenience');
		return cf.promise.then();
	});

	beforeEach(function() {
		room = helper.createRoom();
		// Force all emits into a reply.
		room.robot.on('ibmcloud.formatter', function(event) {
			if (event.message) {
				event.response.reply(event.message);
			}
			else {
				event.response.send({attachments: event.attachments});
			}
		});
	});

	afterEach(function() {
		room.destroy();
	});


	context('Testing an invalid elasticsearch client', function() {
		let saveESUrl;

		before(function() {
			saveESUrl = process.env.HUBOT_AUDIT_ENDPOINT;
			delete process.env.HUBOT_AUDIT_ENDPOINT;
			let es = require('../src/lib/es');
			es.clearClient();
		});

		after(function() {
			room.destroy();
			process.env.HUBOT_AUDIT_ENDPOINT = saveESUrl;
		});

		it('should respond with not available', function() {
			process.env.uuid = 'prob_nothing';
			return room.user.say('mimiron', '@hubot app show me problems today').then(() => {
				return delay(100);
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.problems.error')]);
			});
		});

	});

	context('user query bot problematic apps', function() {

		// Controlling what data is returned from ES for the usage query is done via the container uuid environment variable.

		it('should respond with no problematic apps', function() {
			process.env.uuid = 'prob_nothing';
			return room.user.say('mimiron', '@hubot app show me problems today').then(() => {
				return delay(100);
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.problems.no.problematic', ' today')]);
			});
		});

		it('should respond with error due to invalid response', function() {
			process.env.uuid = 'prob_invalid';
			return room.user.say('mimiron', '@hubot app show me problems today').then(() => {
				return delay(100);
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.problems.error')]);
			});
		});

		it('should respond with problematic apps for today', function() {
			process.env.uuid = 'prob_today';
			return room.user.say('mimiron', '@hubot app show me problems today').then(() => {
				return delay(100);
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot',
					'@mimiron \n' + i18n.__('app.problems.most.problematic', '3', ' today', '\n1. The \`testapp6\` application crashed \`3\` times and had \`1\` cpu and \`1\` disk threshold violations.\n2. The \`testapp5\` application crashed \`5\` times.\n3. The \`testapp4\` application had \`4\` cpu threshold violations.')
				]);
			});
		});

		it('should respond with problematic apps for the week', function() {
			process.env.uuid = 'prob_week';
			return room.user.say('mimiron', '@hubot app show me problems this week').then(() => {
				return delay(100);
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot',
					'@mimiron \n' + i18n.__('app.problems.most.problematic', '5', ' this week', '\n1. The \`testapp6\` application crashed \`4\` times and had \`3\` cpu, \`1\` memory, and \`4\` disk threshold violations.\n2. The \`testapp5\` application crashed \`6\` times and had \`1\` cpu and \`3\` memory threshold violations.\n3. The \`testapp4\` application had \`4\` memory and \`4\` disk threshold violations.\n4. The \`testapp3\` application crashed \`5\` times and had \`1\` disk threshold violation.\n5. The \`testapp2\` application crashed \`1\` time and had \`3\` memory threshold violations.')
				]);
			});
		});

		it('should respond with problematic apps', function() {
			process.env.uuid = 'prob_week';
			return room.user.say('mimiron', '@hubot app show me problems').then(() => {
				return delay(100);
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot',
					'@mimiron \n' + i18n.__('app.problems.most.problematic', '5', '', '\n1. The \`testapp6\` application crashed \`4\` times and had \`3\` cpu, \`1\` memory, and \`4\` disk threshold violations.\n2. The \`testapp5\` application crashed \`6\` times and had \`1\` cpu and \`3\` memory threshold violations.\n3. The \`testapp4\` application had \`4\` memory and \`4\` disk threshold violations.\n4. The \`testapp3\` application crashed \`5\` times and had \`1\` disk threshold violation.\n5. The \`testapp2\` application crashed \`1\` time and had \`3\` memory threshold violations.')
				]);
			});
		});

		it('should respond with error', function() {
			process.env.uuid = 'week';
			return room.user.say('mimiron', '@hubot app show me problems').then(() => {
				return delay(100);
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.problems.error')]);
			});
		});
	});

});
