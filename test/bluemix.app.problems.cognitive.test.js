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

// Passing arrow functions to mocha is discouraged: https://mochajs.org/#arrow-functions
// return promises from mocha tests rather than calling done() - http://tobyho.com/2015/12/16/mocha-with-promises/
describe('Testing problematic apps via Natural Language', function() {

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

		it('should respond with not available', function(done) {
			process.env.uuid = 'prob_nothing';
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('app.problems.error'));
				done();
			});

			let res = { message: {text: 'What apps are showing problems today?'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.app.problems', res, {timeframe: 'today'});
		});

	});

	context('user query bot problematic apps', function() {
		it('should respond with no problematic apps', function(done) {
			process.env.uuid = 'prob_nothing';
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('app.problems.no.problematic', ' today'));
				done();
			});

			let res = { message: {text: 'What apps are showing problems today?'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.app.problems', res, {timeframe: 'today'});
		});

		it('should respond with with error as timeframe could not be determined', function(done) {
			process.env.uuid = 'prob_nothing';
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('cognitive.parse.problem.timeframe'));
				done();
			});

			let res = { message: {text: 'What apps are showing problems lately?'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.app.problems', res, {});
		});
	});

});
