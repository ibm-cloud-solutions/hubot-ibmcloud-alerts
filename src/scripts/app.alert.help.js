// Description:
//	Listens for commands to initiate actions against Bluemix for apps
//
// Configuration:
//	 HUBOT_BLUEMIX_API Bluemix API URL
//	 HUBOT_BLUEMIX_ORG Bluemix Organization
//	 HUBOT_BLUEMIX_SPACE Bluemix space
//	 HUBOT_BLUEMIX_USER Bluemix User ID
//	 HUBOT_BLUEMIX_PASSWORD Password for the Bluemix User
//
// Author:
//	kholdaway
//
/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

var path = require('path');
var TAG = path.basename(__filename);

// --------------------------------------------------------------
// i18n (internationalization)
// It will read from a peer messages.json file.  Later, these
// messages can be referenced throughout the module.
// --------------------------------------------------------------
var i18n = new (require('i18n-2'))({
	locales: ['en'],
	extension: '.json',
	// Add more languages to the list of locales when the files are created.
	directory: __dirname + '/../messages',
	defaultLocale: 'en',
	// Prevent messages file from being overwritten in error conditions (like poor JSON).
	updateFiles: false
});
// At some point we need to toggle this setting based on some user input.
i18n.setLocale('en');

const COMMAND_ALERTS_HELP = /(alert|alerts)\s+help/i;

module.exports = (robot) => {

	robot.on('alerts.help', (res) => {
		robot.logger.debug(`${TAG}: alerts.help Natural Language match.`);
		help(res);
	});

	robot.respond(COMMAND_ALERTS_HELP, {id: 'alerts.help'}, (res) => {
		robot.logger.debug(`${TAG}: alerts.help Reg Ex match.`);
		help(res);
	});

	function help(res) {
		robot.logger.debug(`${TAG}: alert help res.message.text=${res.message.text}.`);
		robot.logger.info(`${TAG}: Listing help alert...`);
		//   hubot alert me when cpu|memory|disk exceeds x% - Enable resource alert and set threshold.
		//   hubot alert me when app events happen - Enable alerts when events happen for any app in the active space.
		//   hubot alert turn on cpu|memory|disk|event|all - Turns on alerts for specified resource.
		//   hubot alert turn off cpu|memory|disk|event|all - Turns off alerts for specified resource.
		//   hubot alert change cpu|memory|disk threshold to x% - Sets alert threshold for specified resource.
		//   hubot alert show|list - Show status of alerting.

		let help =
			`${robot.name} alert change cpu|memory|disk threshold to x% - ` + i18n.__('help.app.alert.change') + '\n';
		help += `${robot.name} alert list|show - ` + i18n.__('help.app.alert.list') + '\n';
		help += `${robot.name} alert me when cpu|memory|disk exceeds x% - ` + i18n.__('help.app.alert.set.app.resource') +
			'\n';
		help +=
			`${robot.name} alert me when app events happen - ` + i18n.__('help.app.alert.set.app.event') + '\n';
		help += `${robot.name} alert turn on cpu|memory|disk|event|all - ` + i18n.__('help.app.alert.on') + '\n';
		help += `${robot.name} alert turn off cpu|memory|disk|event|all - ` + i18n.__('help.app.alert.off') + '\n';
		help += `${robot.name} app show me problems [today|this week]  - ` + i18n.__('help.app.show.me.problems') + '\n';

		robot.emit('ibmcloud.formatter', { response: res, message: '\n' + help});
	};
};
