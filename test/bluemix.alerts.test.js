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
const palette = require('hubot-ibmcloud-utils').palette;
const mockUtils = require('./mock.utils.cf.js');
const mockESUtils = require('./mock.utils.es.js');
// Leverage rewire to gain access to internal functions.
const rewire = require('rewire');

var i18n = new (require('i18n-2'))({
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

const validSpace = 'testSpace';

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
describe('Interacting with Alerts commands via Reg Ex', function() {

	let room;
	let cf;
	let alertsRewire;

	before(function() {
		mockUtils.setupMockery();
		mockESUtils.setupMockery();
		// initialize cf, hubot-test-helper doesn't test Middleware
		cf = require('hubot-cf-convenience');
		// Rewire target module for access to internal functions.
		// This must come after cf is mocked up.
		alertsRewire = rewire('../src/scripts/app.alerts.js');
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

	context('user sets up alerts', function() {
		it('should respond with no alerts', function() {
			return room.user.say('mimiron', '@hubot alert list').then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.alert.list.off')]);
			});
		});

		it('should enable and turn off all alerts', function() {
			return room.user.say('mimiron', '@hubot alert enable all').then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.alert.enabled', 'all', validSpace)]);
				return room.user.say('mimiron', '@hubot alert turn off all');
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.alert.disabled', 'all', validSpace)]);
				return room.user.say('mimiron', '@hubot alert list');
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.alert.list.off')]);
			});
		});

		it('should enable and adjust alerts', function() {
			return room.user.say('mimiron', '@hubot alert me when memory exceeds 50%').then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.alert.enable.and.set.enabled', 'memory', '50',
					'%',
					validSpace)]);
				return room.user.say('mimiron', '@hubot alert me if cpu exceeds 10 percent');
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot',
					'@mimiron ' + i18n.__('app.alert.enable.and.set.enabled', 'cpu', '10', '%',
						validSpace)
				]);
				return room.user.say('mimiron', '@hubot alert set cpu threshold to 50%');
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' +
					i18n.__('app.alert.config.enabled', 'cpu', '50', '%',
						validSpace)
				]);
				return room.user.say('mimiron', '@hubot alert change memory threshold to 90%');
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' +
					i18n.__('app.alert.config.enabled', 'memory', '90', '%',
						validSpace)
				]);
				return room.user.say('mimiron', '@hubot alert list');
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' +
					i18n.__('app.alert.list.enabled', validSpace) + ' cpu:50%, memory:90%\n'
				]);
			});
		});

		it('should turn on app events', function() {
			return room.user.say('mimiron', '@hubot alert me when app events happen').then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.alert.enable.app.events', validSpace)]);
				return room.user.say('mimiron', '@hubot alert me if application events happen');
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' +
					i18n.__('app.alert.enable.app.events', validSpace)
				]);
				return room.user.say('mimiron', '@hubot alert list');
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.alert.list.enabled', validSpace) + ' event\n']);
			});
		});
	});

	// ------------------------------------------------------
	// Test: For Slack, emit an alert, via monitorAppEvents.
	// ------------------------------------------------------
	context('Slack: An app event detected', function() {
		it('should trigger a bluemix alert.', function(done) {
			room.robot.adapterName = 'slack';
			return room.user.say('mimiron', '@hubot alert enable all').then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.alert.enabled', 'all', validSpace)]);

				room.robot.on('ibmcloud.formatter', function(event) {
					expect(event.attachments.length).to.eql(1);
					expect(event.attachments[0].fields.length).to.eql(5);
					expect(event.attachments[0].fields[1].title).to.eql(i18n.__('app.alert.monitor.events.type'));
					expect(event.attachments[0].fields[1].value).to.eql('app.crash');
					expect(event.attachments[0].fields[2].title).to.eql(i18n.__('app.alert.monitor.events.space'));
					expect(event.attachments[0].fields[2].value).to.eql('testSpace');
					expect(event.attachments[0].fields[3].title).to.eql(i18n.__('app.alert.monitor.events.user'));
					expect(event.attachments[0].fields[3].value).to.eql('event1Name');
					expect(event.attachments[0].title).to.eql('event1ActeeName');
					done();
				});
				alertsRewire.__get__('monitorAppEvents')(room.robot);
			});
		});
	});

	// ------------------------------------------------------
	// Test: Call internal monitorAppEvents, but not have anything enabled.
	// ------------------------------------------------------
	context('If alerting is not enabled', function() {
		it('no alerts should trigger.', function() {
			alertsRewire.__get__('monitorAppEvents')(room.robot);
			return delay(100).then(() => {
				// wait a bit to allow any mocked http calls to happen, then ensure no alert messages were written to the room.
				expect(room.messages.length).to.eql(0);
			});
		});
	});

	// ------------------------------------------------------
	// Test: For Slack, emit an alert, via monitorAppResources
	// ------------------------------------------------------
	context('Slack: An app event detected', function() {
		it('should trigger a bluemix alert.', function(done) {
			room.robot.adapterName = 'slack';
			return room.user.say('mimiron', '@hubot alert enable all').then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.alert.enabled', 'all', validSpace)]);
				return room.user.say('mimiron', '@hubot alert me when cpu exceeds 50%');
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot',
					'@mimiron ' + i18n.__('app.alert.enable.and.set.enabled', 'cpu', '50', '%', validSpace)
				]);
				return room.user.say('mimiron', '@hubot alert me when memory exceeds 90%');
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot',
					'@mimiron ' + i18n.__('app.alert.enable.and.set.enabled', 'memory', '90', '%', validSpace)
				]);
				room.robot.on('ibmcloud.formatter', function(event) {
					expect(event.attachments.length).to.eql(1);
					expect(event.attachments[0].title).to.eql(i18n.__('app.alert.monitor.resource.title', 'testApp1Name'));
					expect(event.attachments[0].fallback).to.eql(i18n.__('app.alert.monitor.resource.fallback', 'testApp1Name'));
					expect(event.attachments[0].text).to.eql(i18n.__('app.alert.monitor.resource.text.cpu.memory.disk', 'testApp1Name', 'testSpace'));
					expect(event.attachments[0].fields.length).to.eql(2);
					expect(event.attachments[0].fields[0].short).to.eql(false);
					expect(event.attachments[0].fields[0].title).to.eql(i18n.__('app.alert.monitor.resource.instances'));
					let alertText = i18n.__('app.alert.threshold.description', '0') + i18n.__('app.alert.threshold.cpu',
							'99.51', '%') +
						i18n.__('app.alert.threshold.memory', '100', '%') + i18n.__('app.alert.threshold.disk', '100', '%');
					alertText = alertText.substr(0, alertText.length - 1) + '.'; // remove last comma.
					expect(event.attachments[0].fields[0].value).to.eql(alertText);
					expect(event.attachments[0].fields[1].short).to.eql(false);
					expect(event.attachments[0].fields[1].title).to.eql(i18n.__('app.alert.monitor.resource.recommendations'));
					let recText = i18n.__('app.command.or', 'app scale testApp1Name to 2 instances 1280 memory 1536 disk') +
						i18n.__('app.command.or', 'app scale testApp1Name') +
						i18n.__('app.command.last', 'app restart testApp1Name');
					expect(event.attachments[0].fields[1].value).to.eql(recText);
					done();
				});
				alertsRewire.__get__('monitorAppResources')(room.robot);
			}).catch((error) => {
				done(error);
			});
		});
	});

	// ------------------------------------------------------
	// Test: Verify green returned for event STARTED
	// ------------------------------------------------------
	context('Calling getEventColor for STARTED state', function() {
		it('should return the color green', function(done) {
			let color = alertsRewire.__get__('getEventColor')({
				metadata: {
					request: {
						state: 'STARTED'
					}
				}
			});
			expect(color).to.eql(palette.positive);
			done();
		});
	});

	// ------------------------------------------------------
	// Test: Verify red returned for event STOPPED
	// ------------------------------------------------------
	context('Calling getEventColor for STARTED state', function() {
		it('should return the color green', function(done) {
			let color = alertsRewire.__get__('getEventColor')({
				metadata: {
					request: {
						state: 'STOPPED'
					}
				}
			});
			expect(color).to.eql(palette.negative);
			done();
		});
	});

	// ------------------------------------------------------
	// Test: Verify red returned for event with app crashed
	// ------------------------------------------------------
	context('Calling getEventColor for STARTED state', function() {
		it('should return the color green', function(done) {
			let color = alertsRewire.__get__('getEventColor')({
				type: 'app.crash',
				metadata: {
					request: {
						state: 'STARTED'
					}
				}
			});
			expect(color).to.eql(palette.negative);
			done();
		});
	});

	context('user calls `alert help`', function() {
		beforeEach(function() {
			return room.user.say('mimiron', '@hubot alert help');
		});

		it('should respond with help', function() {
			expect(room.messages.length).to.eql(2);
			let help =
				'hubot alert change cpu|memory|disk threshold to x% - ' + i18n.__('help.app.alert.change') + '\n';
			help += 'hubot alert list|show - ' + i18n.__('help.app.alert.list') + '\n';
			help += 'hubot alert me when cpu|memory|disk exceeds x% - ' + i18n.__(
				'help.app.alert.set.app.resource') + '\n';
			help +=
				'hubot alert me when app events happen - ' + i18n.__('help.app.alert.set.app.event') + '\n';
			help += 'hubot alert turn on cpu|memory|disk|event|all - ' + i18n.__('help.app.alert.on') + '\n';
			help += 'hubot alert turn off cpu|memory|disk|event|all - ' + i18n.__('help.app.alert.off') + '\n';
			help += 'hubot app show me problems [today|this week]  - ' + i18n.__('help.app.show.me.problems') + '\n';
			expect(room.messages[1]).to.eql(['hubot', '@mimiron \n' + help]);
		});
	});
});
