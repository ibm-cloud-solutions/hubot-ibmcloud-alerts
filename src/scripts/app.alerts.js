// Description:
//	Alerts user if applications exceed configured thresholds for CPU, Memory and Disk usage.
//
// Configuration:
//	 HUBOT_BLUEMIX_API Bluemix API URL
//	 HUBOT_BLUEMIX_ORG Bluemix Organization
//	 HUBOT_BLUEMIX_SPACE Bluemix space
//	 HUBOT_BLUEMIX_USER Bluemix User ID
//	 HUBOT_BLUEMIX_PASSWORD Password for the Bluemix User
//
// Commands:
//   hubot alert(s) help - Show available commands in the alert category.
//
// Author:
//	kurtism
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

const cf = require('hubot-cf-convenience');
const activity = require('hubot-ibmcloud-activity-emitter');
const palette = require('hubot-ibmcloud-utils').palette;
const dateformat = require('dateformat');

// Alert contexts are objects stored in the robot.brain which hold information about what's being monitored.
// NOTE: This means enabling or disabling monitoring for one consumer doesn't impact the other.
const DEFAULT_ALERT_CONTEXT = 'DEFAULT_ALERT_CONTEXT';

const RESOURCE_ALERT_FREQUENCY = 60 * 1000;
const EVENT_ALERT_FREQUENCY = 10 * 1000;

const COMMAND_ENABLE_ALERTS = /alert\s+(turn on|enable)\s+(cpu|memory|disk|event|all)/i;
const COMMAND_DISABLE_ALERTS = /alert\s+(turn off|disable)\s+(cpu|memory|disk|event|all)/i;
const COMMAND_LIST_ALERTS = /alert\s+(show|list)/i;
const COMMAND_SET_THRESHOLD = /alert\s+(change |set )(cpu|memory|disk|all) threshold to (\d+)\s*(%|percent)/i;
const COMMAND_ENABLE_AND_SET =
	/alert me (when|if)(app | application |\s+)?(cpu|memory|disk) exceeds (\d+)\s*(%|percent)/i;
const COMMAND_ENABLE_APP_EVENTS = /alert me (of|when|if) (app|application) events/i;

const COLOR_NEUTRAL = palette.normal;
const COLOR_GREEN = palette.positive;
const COLOR_RED = palette.negative;

// determines the best color to use when showing event in slack.
function getEventColor(event) {
	var state = '';
	var color = COLOR_NEUTRAL;

	if (event.metadata && event.metadata.request && event.metadata.request.state) {
		state = event.metadata.request.state;
	}

	if (state === 'STARTED') {
		color = COLOR_GREEN;
	}
	else if (state === 'STOPPED') {
		color = COLOR_RED;
	}

	if (event.type === 'app.crash') {
		color = COLOR_RED;
	}

	return color;
}

// a friendly description to represent the event.
function getEventDescription(event) {
	var description = '';

	// covers app start/stop events.
	if (event.metadata && event.metadata.request && event.metadata.request.state) {
		description += 'state: ' + event.metadata.request.state;
	}

	// covers crash events
	if (event.type === 'app.crash') {
		let metadata = event.metadata;

		if (metadata) {
			description = '';
			if (typeof metadata.index === 'number') {
				description += 'index: ' + metadata.index;
			}
			if (metadata.reason) {
				description += ', reason: ' + metadata.reason;
			}
			if (metadata.exit_description) {
				description += ', exit_description: ' + metadata.exit_description;
			}
			if (metadata.exit_status) {
				description += ', exit_status: ' + metadata.exit_status;
			}
		}
		else {
			description = 'CRASHED';
		}
	}

	return description;
}

function getEventActivityId(event) {
	var activity_id = 'activity.app.event';

	if (event.type === 'app.crash') {
		activity_id = 'activity.app.crash';
	}

	return activity_id;
}

// turn on alerts.
//  space: cf.activeSpace
//  type: alert type. undefined means 'all'
//  res: Optional - only used by default context, to provide a way to tie back the asynchronous event notifications to the room where the alerts got enabled.
function enableAlerts(contextKey, robot, space, type, res) {
	const alertContext = robot.brain.get(contextKey);

	if (!type) {
		type = 'all';
	}
	type = type.trim().toLowerCase();

	// get alert config for the space, create if needed.
	var spaceConfig = alertContext.spaceConfig[space.guid];
	if (!spaceConfig) {
		spaceConfig = {
			guid: space.guid,
			name: space.name,
			alerts: {
				cpu: {
					enabled: false,
					threshold: 85
				},
				memory: {
					enabled: false,
					threshold: 85
				},
				disk: {
					enabled: false,
					threshold: 85
				},
				event: {
					enabled: false
				}
			}
		};
		alertContext.spaceConfig[space.guid] = spaceConfig;
	}

	if (type === 'all') {
		for (let t in spaceConfig.alerts) {
			spaceConfig.alerts[t].enabled = true;
		}
	}
	else {
		spaceConfig.alerts[type].enabled = true;
	}

	if (res) {
		let oldRoom = getRoom(spaceConfig.res);
		let newRoom = getRoom(res);

		if (oldRoom && newRoom && oldRoom !== newRoom) {
			// user switch rooms.  tell old room that alerts for this space will go to the new room.
			let message = i18n.__('app.alert.move.complete', spaceConfig.name, newRoom);
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}

		// res, ties back to room.  always send alerts to the latest room they were enabled in.
		spaceConfig.res = res;
	}

	return i18n.__('app.alert.enabled', type, spaceConfig.name);
}

// turn off alerts.
//  space: cf.activeSpace
//  type: alert type. undefined means 'all'
function disableAlerts(contextKey, robot, space, type) {
	var responseText = '';
	const alertContext = robot.brain.get(contextKey);

	if (!type) {
		type = 'all';
	}
	type = type.trim().toLowerCase();

	var spaceConfig = alertContext.spaceConfig[space.guid];
	if (!spaceConfig) {
		responseText = i18n.__('app.alert.disabled.no.alerts', space.name);
	}
	else {
		if (type === 'all') {
			for (let t in spaceConfig.alerts) {
				spaceConfig.alerts[t].enabled = false;
			}
		}
		else {
			spaceConfig.alerts[type].enabled = false;
		}

		responseText = i18n.__('app.alert.disabled', type, space.name);

		if (allAlertsDisabled(spaceConfig)) {
			delete alertContext.spaceConfig[spaceConfig.guid];
		}
	}

	return responseText;
}

function listAlerts(contextKey, robot) {
	var responseText = '';
	const alertContext = robot.brain.get(contextKey);
	const enabledConfigs = getSpacesWithEnabledAlerts(alertContext);

	enabledConfigs.forEach((spaceConfig) => {
		let spaceText = i18n.__('app.alert.list.enabled', spaceConfig.name);

		for (let type in spaceConfig.alerts) {
			let alert = spaceConfig.alerts[type];

			if (alert.enabled) {
				spaceText += ` ${type}${alert.threshold ? ':' + alert.threshold + '%' : ''},`; // nothing to translate
			}
		}

		spaceText = spaceText.substr(0, spaceText.length - 1); // remove last comma.
		responseText += spaceText + '\n';
	});

	if (!responseText.length) {
		responseText = i18n.__('app.alert.list.off');
	}

	return responseText;
}

// sets a threshold for the specified alert type.
//  space: cf.activeSpace
//  type: alert type.  cannot be all or undefined.
//  threshold: caller must pass a #.  This method will check bounds.
function configAlert(contextKey, robot, space, type, threshold) {
	var responseText = '';
	const alertContext = robot.brain.get(contextKey);

	if (threshold < 1 || threshold > 100) {
		responseText += i18n.__('app.alert.config.invalid', threshold, '%');
	}
	else {
		let spaceConfig = alertContext.spaceConfig[space.guid];
		if (!spaceConfig || !spaceConfig.alerts[type].enabled) {
			responseText = i18n.__('app.alert.config.please.enable', type);
		}
		else {
			spaceConfig.alerts[type].threshold = threshold;
			responseText += i18n.__('app.alert.config.enabled', type, threshold, '%', space.name);
		}
	}

	return responseText;
}

// enables alerts for specified type and sets the threshold at the same time.
//  space: cf.activeSpace
//  type: alert type.  cannot be all or undefined.
//  threshold: caller must pass a #.  This method will check bounds.
//  res: Optional - only used by default context, to provide a way to tie back the asynchronous event notifications to the room where the alerts got enabled.
function enableAndSet(contextKey, robot, space, type, threshold, res) {
	var responseText = '';

	if (threshold < 1 || threshold > 100) {
		responseText += i18n.__('app.alert.enable.and.set.invalid', threshold, '%s');
	}
	else {
		enableAlerts(contextKey, robot, space, type, res);
		configAlert(contextKey, robot, space, type, threshold);
		responseText += i18n.__('app.alert.enable.and.set.enabled', type, threshold, '%', space.name);
	}

	return responseText;
}

function enableAppEvents(contextKey, robot, space, res) {
	enableAlerts(contextKey, robot, space, 'event', res);
	return i18n.__('app.alert.enable.app.events', space.name);
}

// Resolves promise with array of stats for a single app.  The array contains 1 element per RUNNING instances of the app.
// The returned promise is never rejected because we want to tolerate some failures in retrieving app stats.
// Failures such as the app got stopped or delete will cause cf.Apps.getStats to be rejected.  In which case we log it, but don't
// reject the returned promise.  That way the inability to retrieve a single apps stats wouldn't prevent us from processing
// the stats of other apps.
function getSingleAppStats(robot, spaceGuid, spaceName, appGuid, appName) {
	return new Promise((resolve, reject) => {
		var appStats = [];

		try {
			robot.logger.info(`${TAG}: Async call using cf module to get stats for appGuid:${appGuid}`);
			cf.Apps.getStats(appGuid).then((result) => {
				// CF returns an object where the key is the instance #.  see: http://apidocs.cloudfoundry.org/214/apps/get_detailed_stats_for_a_started_app.html
				// We want to return an array of objects, one for each instance.  So we move the instance # into the objects we
				// return along with other useful info that is missing from the object returned by CF.
				for (let instance in result) {
					let obj = result[instance];

					if (obj.state === 'RUNNING' && obj.stats && obj.stats.usage) {
						obj.stats.instance = instance;
						obj.stats.space_guid = spaceGuid;
						obj.stats.space_name = spaceName;
						obj.stats.app_guid = appGuid;
						appStats.push(obj.stats);
					}
				}

				resolve(appStats);
			}).catch((reason) => {
				robot.logger.warning(`${TAG}: Unable to retrieve stats from CF for app: ${appName}`);
				robot.logger.warning(reason);
				resolve(appStats);
			});
		}
		catch (error) {
			robot.logger.error(`${TAG}: Unable to retrieve stats from CF for app: ${appName}`);
			robot.logger.error(error);
			resolve(appStats);
		}
	});
}

// gets "thresholds alerts" describing any resource usage violation based on the thresholds in the provide space config.
function getThresholdAlerts(robot, spaceConfig) {
	return new Promise((resolve, reject) => {
		var thresholdAlerts = [];

		try {
			robot.logger.info(`${TAG}: Async call using cf module to get summary for space:${spaceConfig.guid}`);
			cf.Spaces.getSummary(spaceConfig.guid).then((result) => {
				if (result.apps && result.apps.length) {
					var appStatsPromises = [];
					result.apps.forEach((app) => {
						if (app.state === 'STARTED') {
							appStatsPromises.push(getSingleAppStats(robot, spaceConfig.guid, spaceConfig.name, app.guid, app.name));
						}
					});

					robot.logger.info(`${TAG}: Async calls (Promise.all) using cf module to get stats for each app.`);
					Promise.all(appStatsPromises).then((appStatsResults) => {
						// appStatsResults is an array of arrays.  1 array per app (appStats) containing 1 element per instance (instanceStats).
						appStatsResults.forEach((appStats) => {
							appStats.forEach((instanceStats) => {
								// see if this instance violated any configured thresholds.
								let description = i18n.__('app.alert.threshold.description', instanceStats.instance);
								let violation = false;

								if (spaceConfig.alerts.cpu.enabled && instanceStats.usage.cpu) {
									// Example of 32.9% when returned from CF: 0.3297024299452314
									let percent_used = instanceStats.usage.cpu * 100;
									if (percent_used > spaceConfig.alerts.cpu.threshold) {
										violation = true;
										description += i18n.__('app.alert.threshold.cpu', Math.round(percent_used * 100) / 100, '%');

										activity.emitBotActivity(robot, spaceConfig.res, {
											activity_id: 'activity.threshold.violation.cpu',
											app_name: instanceStats.name,
											app_guid: instanceStats.app_guid,
											space_name: instanceStats.space_name,
											space_guid: instanceStats.space_guid
										});
									}
								}
								if (spaceConfig.alerts.memory.enabled && instanceStats.mem_quota && instanceStats.usage.mem) {
									let percent_used = (instanceStats.usage.mem / instanceStats.mem_quota) * 100;
									if (percent_used > spaceConfig.alerts.memory.threshold) {
										violation = true;
										description += i18n.__('app.alert.threshold.memory', Math.round(percent_used * 100) / 100, '%');
										activity.emitBotActivity(robot, spaceConfig.res, {
											activity_id: 'activity.threshold.violation.memory',
											app_name: instanceStats.name,
											app_guid: instanceStats.app_guid,
											space_name: instanceStats.space_name,
											space_guid: instanceStats.space_guid
										});
									}
								}
								if (spaceConfig.alerts.disk.enabled && instanceStats.disk_quota && instanceStats.usage.disk) {
									let percent_used = (instanceStats.usage.disk / instanceStats.disk_quota) * 100;
									if (percent_used > spaceConfig.alerts.disk.threshold) {
										violation = true;
										description += i18n.__('app.alert.threshold.disk', Math.round(percent_used * 100) / 100, '%');
										activity.emitBotActivity(robot, spaceConfig.res, {
											activity_id: 'activity.threshold.violation.disk',
											app_name: instanceStats.name,
											app_guid: instanceStats.app_guid,
											space_name: instanceStats.space_name,
											space_guid: instanceStats.space_guid
										});
									}
								}

								if (violation) {
									// At least 1 threshold was violated by this instance, so add alert to the results.
									description = description.substr(0, description.length - 1); // remove last comma.
									thresholdAlerts.push({
										space_name: instanceStats.space_name,
										app_name: instanceStats.name,
										description: description
									});
								}
							}); // end processing of an apps instanceStats
						}); // end of each appStats

						resolve(thresholdAlerts);
					}).catch((error) => {
						reject(error);
					});
				}
				else {
					resolve(thresholdAlerts);
				}
			}).catch((reason) => {
				reject(reason);
			});
		}
		catch (error) {
			reject(error);
		}
	});
}

// Returns array of spaceConfigs from the provided context that have at least 1 alert enabled.
// 	thresholdReq - optional: indicates to only consider threshold alerts (used in case we expand in future)
//  alertType - optional: only return configs that have a specific type of alert enabled.
function getSpacesWithEnabledAlerts(alertContext, thresholdReq, alertType) {
	var configs = [];

	for (let guid in alertContext.spaceConfig) {
		let spaceConfig = alertContext.spaceConfig[guid];

		for (let type in spaceConfig.alerts) {
			let alert = spaceConfig.alerts[type];
			if (thresholdReq && !alert.threshold) {
				// don't include.
			}
			else if (alertType && type !== alertType) {
				// don't include.
			}
			else if (alert.enabled) {
				configs.push(spaceConfig);
				break;
			}
		}
	}

	return configs;
}

function getRoom(res) {
	var room;

	if (res && res.message && res.message.room) {
		room = res.message.room;
	}

	return room;
}

function allAlertsDisabled(spaceConfig) {
	var enabled = false;

	for (let type in spaceConfig.alerts) {
		let alert = spaceConfig.alerts[type];
		if (alert.enabled) {
			enabled = true;
		}
	}

	return !enabled;
}

// Periodically monitor app resource usage and send notifications to the robot if usage exceeds configured thresholds.
// This scheduled function services the DEFAULT_ALERT_CONTEXT only.
function monitorAppResources(robot) {
	const alertContext = robot.brain.get(DEFAULT_ALERT_CONTEXT);
	const enabledConfigs = getSpacesWithEnabledAlerts(alertContext, true);

	if (!enabledConfigs.length) {
		// thresholds alerts are not enabled for any spaces.
		setTimeout(monitorAppResources, RESOURCE_ALERT_FREQUENCY, robot);
		return;
	}

	// promise for the processing of each space.  These promises wouldn't be rejected, so that rescheduling
	// wouldn't take place until processing of each space has completed regardless if 1 space fails to process.
	var spacePromises = [];
	var processSpace = function(spaceConfig) {
		return new Promise((resolve, reject) => {
			robot.logger.info(`${TAG}: Async call to getThresholdAlerts() for space:${spaceConfig.guid}`);
			getThresholdAlerts(robot, spaceConfig).then((result) => {
				result.forEach((alert) => {
					let attachments = [];

					attachments.push({
						fallback: i18n.__('app.alert.monitor.resource.fallback', alert.app_name),
						title: i18n.__('app.alert.monitor.resource.title', alert.space_name),
						color: COLOR_RED,
						fields: [{
							title: i18n.__('app.alert.monitor.resource.app', alert.app_name),
							value: alert.description,
							short: false
						}]
					});

					// Emit the app alert as an attachment
					robot.emit('ibmcloud.formatter', {
						response: spaceConfig.res,
						attachments
					});
				});
				resolve();
			}).catch((error) => {
				robot.logger.error(`${TAG}: Error processing threshold alerts for space: ${spaceConfig.name}`);
				robot.logger.error(error);
				resolve();
			});
		});
	};

	enabledConfigs.forEach((spaceConfig) => {
		spacePromises.push(processSpace(spaceConfig));
	});

	robot.logger.info(`${TAG}: Async calls (Promise.all) to get alerts for each space.`);
	Promise.all(spacePromises).then((results) => {
		// all spaces have been processed.  set timeout to keep monitor going.
		setTimeout(monitorAppResources, RESOURCE_ALERT_FREQUENCY, robot);
	}).catch((error) => {
		robot.logger.error(`${TAG}: Error processing threshold alerts for all spaces (Promise.all).`);
		robot.logger.error(error);
		setTimeout(monitorAppResources, RESOURCE_ALERT_FREQUENCY, robot);
	});
}

// Periodically query events and send notifications to the robot if events happen for apps in spaces we are monitoring.
// This scheduled function services the DEFAULT_ALERT_CONTEXT only.
function monitorAppEvents(robot) {
	const alertContext = robot.brain.get(DEFAULT_ALERT_CONTEXT);
	const enabledConfigs = getSpacesWithEnabledAlerts(alertContext, false, 'event');

	if (!enabledConfigs.length) {
		// event alerts are not enabled for any spaces.
		setTimeout(monitorAppEvents, EVENT_ALERT_FREQUENCY, robot);
		return;
	}

	const enabledConfigsByGuid = {};
	enabledConfigs.forEach((spaceConfig) => {
		enabledConfigsByGuid[spaceConfig.guid] = spaceConfig;
	});

	let filter = 'timestamp>' + new Date(alertContext.events_since_time).toISOString();

	try {
		robot.logger.info(`${TAG}: Async call using cf module to get events using filter:${filter}`);
		cf.Events.getEvents({
			q: filter
		}).then((result) => {
			// result.resources is an array of events in ascending order.
			// see: http://apidocs.cloudfoundry.org/214/events/list_all_events.html
			if (result && result.resources) {
				let lastEvent;
				let eventsGroupedByApp = {};

				if (result.resources.length) {
					lastEvent = result.resources[result.resources.length - 1].entity;

					result.resources.forEach((element) => {
						let event = element.entity;

						// actee is guid of app that the event happened for.  only include events for apps in spaces we are monitoring.
						if (event.actee && event.actee_type === 'app' && event.space_guid && enabledConfigsByGuid[event.space_guid]) {
							let appEvents = eventsGroupedByApp[event.actee];

							if (!appEvents) {
								appEvents = [];
								eventsGroupedByApp[event.actee] = appEvents;
							}

							appEvents.push(event);
							let sConfig = enabledConfigsByGuid[event.space_guid];
							activity.emitBotActivity(robot, sConfig.res, {
								activity_id: getEventActivityId(event),
								app_name: event.actee_name,
								app_guid: event.actee,
								space_name: sConfig.name,
								space_guid: sConfig.guid,
								event_type: event.type
							});
						}
					});
				}

				// have all the events grouped by app guid (ascending order).  now send them in appropriate format, to appropriate destination.
				Object.keys(eventsGroupedByApp).forEach((appGuid) => {
					let appEvents = eventsGroupedByApp[appGuid];
					let appName = appEvents[0].actee_name;
					let spaceConfig = enabledConfigsByGuid[appEvents[0].space_guid];
					let spaceRes = spaceConfig.res;
					let attachments = [];

					// For slack leave events in ascending order.
					appEvents.forEach((event) => {
						attachments.push({
							fallback: i18n.__('app.alert.monitor.events.fallback', appName),
							title: appName,
							color: getEventColor(event),
							fields: [{
								title: i18n.__('app.alert.monitor.events.timestamp'),
								value: dateformat(event.timestamp, 'yyyy-mm-dd HH:MM:ss'),
								short: true
							}, {
								title: i18n.__('app.alert.monitor.events.type'),
								value: event.type,
								short: true
							}, {
								title: i18n.__('app.alert.monitor.events.space'),
								value: spaceConfig.name,
								short: true
							}, {
								title: i18n.__('app.alert.monitor.events.user'),
								value: event.actor_name ? event.actor_name : 'unknown',
								short: true
							}, {
								title: i18n.__('app.alert.monitor.events.description'),
								value: getEventDescription(event),
								short: false
							}]
						});
					});

					// Emit the app status as an attachment
					robot.emit('ibmcloud.formatter', {
						response: spaceRes,
						attachments
					});
				});

				if (lastEvent) {
					// set timestamp to query 1 second after the last event we detected.
					alertContext.events_since_time = Date.parse(lastEvent.timestamp) + 1000;
				}
			}
			else {
				robot.logger.error(`${TAG}: unexpected response from CF event request: ${JSON.stringify(result, null, 2)}`);
			}

			setTimeout(monitorAppEvents, EVENT_ALERT_FREQUENCY, robot);
		}).catch((reason) => {
			// will catch any errors in then(...) function.
			robot.logger.error(`${TAG}: Error from monitorAppEvents:`);
			robot.logger.error(reason);
			if (reason.dumpstack) {
				robot.logger.error(reason.dumpstack);
			}
			setTimeout(monitorAppEvents, EVENT_ALERT_FREQUENCY, robot);
		});
	}
	catch (error) {
		// will catch any errors coming from getEvents(...) call.
		robot.logger.error(`${TAG}: Error from monitorAppEvents:getEvents()`);
		robot.logger.error(error);
		if (error.dumpstack) {
			robot.logger.error(error.dumpstack);
		}
		setTimeout(monitorAppEvents, EVENT_ALERT_FREQUENCY, robot);
	}
}

module.exports = (robot) => {

	// initialize contexts
	robot.brain.set(DEFAULT_ALERT_CONTEXT, {
		events_since_time: new Date().getTime(),
		spaceConfig: {} // config info for alerts in each space
	});

	robot.on('bluemix.alerts.enable', (res, parameters) => {
		robot.logger.debug(`${TAG}: bluemix.alerts.enable Natural Language match.`);
		if (parameters && parameters.type) {
			const type = parameters.type;
			enableAlertsWrapper(res, type);
		}
		else {
			robot.logger.error(`${TAG}: Error extracting Type from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.type');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
	});
	robot.respond(COMMAND_ENABLE_ALERTS, {
		id: 'bluemix.alerts.enable'
	}, (res) => {
		robot.logger.debug(`${TAG}: bluemix.alerts.enable Reg Ex match.`);
		const type = res.match[2];
		enableAlertsWrapper(res, type);
	});
	function enableAlertsWrapper(res, type) {
		robot.logger.debug(`${TAG}: bluemix.alerts.enable res.message.text=${res.message.text}.`);
		let message = enableAlerts(DEFAULT_ALERT_CONTEXT, robot, cf.activeSpace(robot, res), type, res);
		robot.emit('ibmcloud.formatter', { response: res, message: message});
	};

	robot.on('bluemix.alerts.disable', (res, parameters) => {
		robot.logger.debug(`${TAG}: bluemix.alerts.disable Natural Language match.`);
		if (parameters && parameters.type) {
			const type = parameters.type;
			disableAlertsWrapper(res, type);
		}
		else {
			robot.logger.error(`${TAG}: Error extracting Type from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.type');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
	});
	robot.respond(COMMAND_DISABLE_ALERTS, {
		id: 'bluemix.alerts.disable'
	}, (res) => {
		robot.logger.debug(`${TAG}: bluemix.alerts.disable Reg Ex match.`);
		const type = res.match[2];
		disableAlertsWrapper(res, type);
	});
	function disableAlertsWrapper(res, type) {
		robot.logger.debug(`${TAG}: bluemix.alerts.disable res.message.text=${res.message.text}.`);
		let message = disableAlerts(DEFAULT_ALERT_CONTEXT, robot, cf.activeSpace(robot, res), type);
		robot.emit('ibmcloud.formatter', { response: res, message: message});
	};

	robot.on('bluemix.alerts.list', (res) => {
		robot.logger.debug(`${TAG}: bluemix.alerts.list Natural Language match.`);
		listAlertsWrapper(res);
	});
	robot.respond(COMMAND_LIST_ALERTS, {
		id: 'bluemix.alerts.list'
	}, (res) => {
		robot.logger.debug(`${TAG}: bluemix.alerts.list Reg Ex match.`);
		listAlertsWrapper(res);
	});
	function listAlertsWrapper(res) {
		robot.logger.debug(`${TAG}: bluemix.alerts.list res.message.text=${res.message.text}.`);
		let message = listAlerts(DEFAULT_ALERT_CONTEXT, robot);
		robot.emit('ibmcloud.formatter', { response: res, message: message});
	}

	robot.on('bluemix.alerts.threshold', (res, parameters) => {
		robot.logger.debug(`${TAG}: bluemix.alerts.threshold Natural Language match.`);
		let thresholdType;
		let threshold;
		if (parameters && parameters.thresholdType) {
			thresholdType = parameters.thresholdType;
		}
		else {
			robot.logger.error(`${TAG}: Error extracting Threshold Type from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.thresholdType');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
		if (parameters && parameters.threshold) {
			threshold = Number(parameters.threshold);
		}
		else {
			robot.logger.error(`${TAG}: Error extracting Threshold from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.threshold');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
		if (thresholdType && threshold) {
			configAlertWrapper(res, thresholdType, threshold);
		}
	});
	robot.respond(COMMAND_SET_THRESHOLD, {
		id: 'bluemix.alerts.threshold'
	}, (res) => {
		robot.logger.debug(`${TAG}: bluemix.alerts.threshold Reg Ex match.`);
		const type = res.match[2];
		const threshold = Number(res.match[3]);
		configAlertWrapper(res, type, threshold);
	});
	function configAlertWrapper(res, type, threshold) {
		robot.logger.debug(`${TAG}: bluemix.alerts.threshold res.message.text=${res.message.text}.`);
		let message = configAlert(DEFAULT_ALERT_CONTEXT, robot, cf.activeSpace(robot, res), type, threshold);
		robot.emit('ibmcloud.formatter', { response: res, message: message});
	};

	robot.on('bluemix.alerts.enableAndSet', (res, parameters) => {
		robot.logger.debug(`${TAG}: bluemix.alerts.enableAndSet Natural Language match.`);
		let thresholdType;
		let threshold;
		if (parameters && parameters.thresholdType) {
			thresholdType = parameters.thresholdType;
		}
		else {
			robot.logger.error(`${TAG}: Error extracting Threshold Type from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.thresholdType');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
		if (parameters && parameters.threshold) {
			threshold = Number(parameters.threshold);
		}
		else {
			robot.logger.error(`${TAG}: Error extracting Threshold from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.threshold');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
		if (thresholdType && threshold) {
			enableAndSetWrapper(res, thresholdType, threshold);
		}
	});
	robot.respond(COMMAND_ENABLE_AND_SET, {
		id: 'bluemix.alerts.enableAndSet'
	}, (res) => {
		robot.logger.debug(`${TAG}: bluemix.alerts.enableAndSet Reg Ex match.`);
		const type = res.match[3];
		const threshold = Number(res.match[4]);
		enableAndSetWrapper(res, type, threshold);
	});
	function enableAndSetWrapper(res, type, threshold) {
		robot.logger.debug(`${TAG}: bluemix.alerts.enableAndSet res.message.text=${res.message.text}.`);
		let message = enableAndSet(DEFAULT_ALERT_CONTEXT, robot, cf.activeSpace(robot, res), type, threshold, res);
		robot.emit('ibmcloud.formatter', { response: res, message: message});
	};

	robot.on('bluemix.alerts.app.enable', (res, parameters) => {
		robot.logger.debug(`${TAG}: bluemix.alerts.app.enable Natural Language match.`);
		enableAppEventsWrapper(res);
	});
	robot.respond(COMMAND_ENABLE_APP_EVENTS, {
		id: 'bluemix.alerts.app.enable'
	}, (res) => {
		robot.logger.debug(`${TAG}: bluemix.alerts.app.enable Reg Ex match.`);
		enableAppEventsWrapper(res);
	});
	function enableAppEventsWrapper(res) {
		robot.logger.debug(`${TAG}: bluemix.alerts.app.enable res.message.text=${res.message.text}.`);
		let message = enableAppEvents(DEFAULT_ALERT_CONTEXT, robot, cf.activeSpace(robot, res), res);
		robot.emit('ibmcloud.formatter', { response: res, message: message});
	}

	// Start monitoring for resource threshold violations.  Intentionally not using setInterval, b/c of lag when querying CF.
	setTimeout(monitorAppResources, RESOURCE_ALERT_FREQUENCY, robot);

	// Start monitoring for app event alerts.  Intentionally not using setInterval, b/c of lag when querying CF.
	setTimeout(monitorAppEvents, EVENT_ALERT_FREQUENCY, robot);
};
