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

// Passing arrow functions to mocha is discouraged: https://mochajs.org/#arrow-functions
// return promises from mocha tests rather than calling done() - http://tobyho.com/2015/12/16/mocha-with-promises/
describe('Interacting with Alerts via Natural Language', function() {

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

	context('user sets up alerts', function() {
		it('should respond with no alerts', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('app.alert.list.off'));
				done();
			});

			var res = { message: {text: 'Show my alerts'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.alerts.list', res, {});
		});

		it('should enable alerts', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('app.alert.enabled', 'all', validSpace));
				done();
			});

			var res = { message: {text: 'Enable all alerts'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.alerts.enable', res, {type: 'all'});
		});

		it('should fail to enable alerts', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('cognitive.parse.problem.type'));
				done();
			});

			var res = { message: {text: 'Enable alerts'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.alerts.enable', res, {});
		});

		it('should disable alerts', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('app.alert.disabled.no.alerts', validSpace));
				done();
			});

			var res = { message: {text: 'Disable all alerts'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.alerts.disable', res, {type: 'all'});
		});

		it('should fail to disable alerts', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('cognitive.parse.problem.type'));
				done();
			});

			var res = { message: {text: 'Disable alerts'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.alerts.disable', res, {});
		});

		it('should enable alerts', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('app.alert.enable.and.set.enabled', 'cpu', '10', '%',
				validSpace));
				done();
			});

			var res = { message: {text: 'Enable cpu threshold alerts at 10%'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.alerts.enableAndSet', res, {thresholdType: 'cpu', threshold: 10});
		});

		it('should fail to enable alerts due to missing thresholdType', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('cognitive.parse.problem.thresholdType'));
				done();
			});

			var res = { message: {text: 'Enable cpu threshold alerts at 10%'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.alerts.enableAndSet', res, {threshold: 10});
		});

		it('should fail to enable alerts due to missing threshold', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('cognitive.parse.problem.threshold'));
				done();
			});

			var res = { message: {text: 'Enable cpu threshold alerts at 10%'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.alerts.enableAndSet', res, {thresholdType: 'cpu'});
		});

		it('should set alerts threshold', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('app.alert.config.please.enable', 'cpu'));
				done();
			});

			var res = { message: {text: 'Set cpu alert threshold to 10%'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.alerts.threshold', res, {thresholdType: 'cpu', threshold: 10});
		});

		it('should fail to set alerts threshold missing thresholdType', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('cognitive.parse.problem.thresholdType'));
				done();
			});

			var res = { message: {text: 'Set cpu alert threshold to 10%'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.alerts.threshold', res, {threshold: 10});
		});

		it('should fail to set alerts threshold missing threshold', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('cognitive.parse.problem.threshold'));
				done();
			});

			var res = { message: {text: 'Set cpu alert threshold to 10%'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.alerts.threshold', res, {thresholdType: 'cpu'});
		});

		it('should turn on app events', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain(i18n.__('app.alert.enable.app.events', validSpace));
				done();
			});

			var res = { message: {text: 'start monitoring my apps'}, user: {id: 'anId'}, response: room };
			room.robot.emit('bluemix.alerts.app.enable', res, {});
		});
	});

	context('user calls `alert help`', function() {
		it('should respond with help', function(done) {
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.be.a('string');
				expect(event.message).to.contain('hubot alert me when app events happen');
				expect(event.message).to.contain('hubot alert turn on cpu|memory|disk|event|all');
				done();
			});

			var res = { message: {text: 'Can you help me with app alerts?'}, user: {id: 'anId'}, response: room };
			room.robot.emit('alerts.help', res, {});
		});
	});
});
