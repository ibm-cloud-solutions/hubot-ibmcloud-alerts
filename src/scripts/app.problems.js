// Description:
//	Shows the top 5 problematic applications in the active space.
//
// Configuration:
//	 HUBOT_AUDIT_ENDPOINT Elastic search endpoint.
//   uuid Unique identifier of container running this bot.
//
// Author:
//	houghtoj
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

const es = require('../lib/es');// getClient() will only be set if usage tracking is enabled and the related ES index is ready to use.
const activity = require('hubot-ibmcloud-activity-emitter');

const SHOW_APP_PROBLEMS = /app\sshow\sme\sproblems\s?(today|this week)?/i;

const MAX_PROBLEMATIC_APPS = 5;

/*
 * Returns an 's' if the count is greater than 0, otherwise ''
 */
function getTrailingS(count) {
	return (count === 1 ? '' : 's');
}

/*
 * Create display string based upon the given counts.
 */
function getDisplayString(probIndex, appName, crashCount, cpuCount, memoryCount, diskCount) {
	var dispString = `\n${probIndex}. The \`${appName}\` application `;

	// Add crash count with slack annotations to display string
	if (crashCount > 0) {
		dispString += `crashed \`${crashCount}\` time${getTrailingS(crashCount)}`;
	}

	// Add threshold count display string
	let threshCount = cpuCount + memoryCount + diskCount;
	if (threshCount > 0) {

		// Add 'had ' or ' and had ' before threshold counts to display string
		if (crashCount) dispString += ' and ';
		dispString += 'had ';

		// Figure out separating text to put before memory and disk counts
		var memPreText = '';
		var diskPreText = '';
		if (cpuCount > 0) {
			if (memoryCount > 0) {
				if (diskCount > 0) {
					memPreText = ', ';
					diskPreText = ', and ';
				}
				else {
					memPreText = ' and ';
				}
			}
			else {
				if (diskCount > 0) {
					diskPreText = ' and ';
				}
			}
		}
		else {
			if (memoryCount > 0) {
				if (diskCount > 0) {
					diskPreText = ' and ';
				}
			}
		}

		// Add each of the three threshold violation counts (if greater than 0) with
		// slack annotations to display string
		if (cpuCount > 0) {
			dispString += `\`${cpuCount}\` cpu`;
		}
		if (memoryCount > 0) {
			dispString += `${memPreText}\`${memoryCount}\` memory`;
		}
		if (diskCount > 0) {
			dispString += `${diskPreText}\`${diskCount}\` disk`;
		}

		// Add trailing threshold violation text to display string
		dispString += ` threshold violation${getTrailingS(threshCount)}`;

	}

	// Add trailing period to display string
	dispString += '.';

	// Return display string
	return dispString;
}

// Return a promise that will be resolved with a problematic report for the specified timeframe.
// Valid timeframes: today, this week
// Asssumption: It is assumed that the index is set up by the usage command initialization.
function getMostProblematic(robot, timeframe) {
	if (!es.getClient()) {
		return Promise.resolve(i18n.__('app.problems.error'));
	}

	return new Promise((resolve, reject) => {
		var startTime = new Date();
		var endTime = new Date();
		let dispTimeframe = ' ' + timeframe;
		if (!timeframe) {
			startTime.setTime(0);
			dispTimeframe = '';
		}
		else if (timeframe.indexOf('today') > -1) {
			// This is 12 midnight in the timezone the bot is running in.
			startTime.setHours(0, 0, 0, 0);
		}
		else if (timeframe.indexOf('week') > -1) {
			// 7 days from now.
			var seven_days_in_ms = 1000 * 60 * 60 * 24 * 7;
			startTime = new Date(startTime - seven_days_in_ms);
		}

		const app_problems_query = {
			query: {
				query_string: {
					query: `timestamp:[${startTime.getTime()} TO ${endTime.getTime()}] AND container_uuid:${es.getContainerUUID()} AND (activity_id:activity.app.crash OR activity_id:activity.threshold.violation.cpu OR activity_id:activity.threshold.violation.memory OR activity_id:activity.threshold.violation.disk)`,
					lowercase_expanded_terms: false
				}
			},
			aggs: { app_problems: { terms: { field: 'app_name', order: { _count: 'desc' } },
						aggs: { app_activity_type: { terms: { field: 'activity_id', order: { _count: 'desc' } } } } } }
		};

		let queryBodyStr = JSON.stringify(app_problems_query);
		robot.logger.info(`${TAG}: Asynch call to ES client search for index:${es.BOTACTIVITY_INDEX_NAME} with body:${queryBodyStr}.`);
		es.getClient().search({
			index: es.BOTACTIVITY_INDEX_NAME,
			type: es.BOTACTIVITY_DOC_TYPE,
			searchType: 'count',
			body: app_problems_query
		}).then((result) => {
			if (result && result.aggregations && result.aggregations.app_problems && result.aggregations.app_problems.buckets) {
				let buckets = result.aggregations.app_problems.buckets;
				let problematicApps = '';
				var problematicAppCount = 0;

				for (var i = 0; (i < buckets.length && problematicAppCount < MAX_PROBLEMATIC_APPS); i++) {
					let bucket = buckets[i];
					let appName = bucket.key;
					let crashCount = 0;
					let cpuThresholdViolationCount = 0;
					let memoryThresholdViolationCount = 0;
					let diskThresholdViolationCount = 0;
					if (bucket.app_activity_type && bucket.app_activity_type.buckets) {
						let subbuckets = bucket.app_activity_type.buckets;
						for (var j = 0; j < subbuckets.length; j++) {
							let subbucket = subbuckets[j];
							if (subbucket.key === 'activity.app.crash') {
								crashCount += subbucket.doc_count;
							}
							else if (subbucket.key === 'activity.threshold.violation.cpu') {
								cpuThresholdViolationCount += subbucket.doc_count;
							}
							else if (subbucket.key === 'activity.threshold.violation.memory') {
								memoryThresholdViolationCount += subbucket.doc_count;
							}
							else if (subbucket.key === 'activity.threshold.violation.disk') {
								diskThresholdViolationCount += subbucket.doc_count;
							}
						}
					}
					if (crashCount > 0 || cpuThresholdViolationCount > 0 || memoryThresholdViolationCount > 0 || diskThresholdViolationCount > 0) {
						problematicAppCount += 1;
						problematicApps += getDisplayString(problematicAppCount, appName, crashCount, cpuThresholdViolationCount, memoryThresholdViolationCount, diskThresholdViolationCount);
					}
				}

				activity.emitBotActivity(robot, null, {activity_id: 'activity.app.problems'});

				if (problematicAppCount > 0) {
					resolve('\n' + i18n.__('app.problems.most.problematic', problematicAppCount, dispTimeframe, problematicApps));
				}
				else {
					resolve(i18n.__('app.problems.no.problematic', dispTimeframe));
				}
			}
			else {
				robot.logger.error(`${TAG}: Error while getting the most problematic app:\nUnexpected query result from Elasticsearch. Result: ${JSON.stringify(result, null, 2)}`);
				resolve(i18n.__('app.problems.error'));
			}
		}).catch((error) => {
			robot.logger.error(`${TAG}: Error while getting the most problematic app:\n` + error);
			resolve(i18n.__('app.problems.error'));
		});
	});
}

module.exports = (robot) => {

	// Initialize the bot es
	es.initBotActivity(robot);

	robot.on('bluemix.app.problems', (res, parameters) => {
		robot.logger.debug(`${TAG}: bluemix.app.problems Natural Language match.`);
		if (parameters && parameters.timeframe) {
			const timeframe = parameters.timeframe;
			showAppProblems(res, timeframe);
		}
		else {
			robot.logger.error(`${TAG}: Error extracting Timeframe from text=[${res.message.text}].`);
			let message = i18n.__('cognitive.parse.problem.timeframe');
			robot.emit('ibmcloud.formatter', { response: res, message: message});
		}
	});

	robot.respond(SHOW_APP_PROBLEMS, {id: 'bluemix.app.problems'}, (res) => {
		robot.logger.debug(`${TAG}: bluemix.app.problems Reg Ex match.`);
		const timeframe = res.match[1];
		showAppProblems(res, timeframe);
	});

	function showAppProblems(res, timeframe) {
		robot.logger.debug(`${TAG}: bluemix.alerts SHOW_APP_PROBLEMS res.message.text=${res.message.text}.`);


		robot.logger.info(`${TAG}: Asynch call to getMostProblematic() for timeframe ${timeframe}.`);
		getMostProblematic(robot, timeframe).then((result) => {
			robot.emit('ibmcloud.formatter', { response: res, message: result});
		});
	}
};
