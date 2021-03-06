/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
/*
 * Captures bot.activity events which are emitted via emitBotActivity calls in our robot scripts.  Stores the events
 * in Elasticsearch.  Also exports a few functions/variables for code interested at getting at these stored events.
 */
'use strict';

const path = require('path');
const TAG = path.basename(__filename);
const url = require('url');
const elasticsearch = require('elasticsearch');

const usage_index_name = 'hubotusage';
const usage_doc_type = 'UsageEntry';
const ACTIVITY_INITIALIZED = 'HUBOTBLUEMIX.ALERT.INITIALIZED';


let AUDIT_ENDPOINT = process.env.HUBOT_AUDIT_ENDPOINT;
const groupId = process.env.group_id || 'DEFAULT_GROUP';

let esHost;
let esClient;

function auditDisabled() {
	let isDisabled = (process.env.HUBOT_BLUEMIX_AUDIT_DISABLED && (process.env.HUBOT_BLUEMIX_AUDIT_DISABLED === 'TRUE' ||
		process.env.HUBOT_BLUEMIX_AUDIT_DISABLED === 'true'));
	let isNotDefined = !AUDIT_ENDPOINT;
	return isDisabled || isNotDefined;
}

function getClient(robot) {
	if (!esClient) {
		// Pull elastic search endpoint from environment variable again
		// this is to work around test case weirdness with clear, but it's ugly
		AUDIT_ENDPOINT = process.env.HUBOT_AUDIT_ENDPOINT;
		esHost = AUDIT_ENDPOINT;
		if (esHost) {
			const esUrl = url.parse(esHost);
			esClient = new elasticsearch.Client({
				maxSockets: 1000,
				requestTimeout: 60000,
				host: {
					protocol: 'https',
					host: esUrl.hostname,
					port: 443,
					headers: {
						'X-HUBOT-AUTH-TOKEN': groupId
					}
				}
			});
		}
		else {
			if (robot) robot.logger.warning(
				`${TAG}: Unable to capture usage information because HUBOT_AUDIT_ENDPOINT environment variable is not set.`);
		}
	}
	return esClient;
}

function clearClient() {
	esClient = undefined;
}

// UUID of the container running this bot.
function getContainerUUID() {
	return process.env.uuid || 'DEFAULT_UUID';
}

/*
 * Initializes elastic search template.
 */
function initElasticsearch(robot) {
	if (auditDisabled() || !getClient()) {
		robot.logger.warning(
			`${TAG}: Auditing is disabled. To enable auditing, ensure HUBOT_AUDIT_ENDPOINT is defined and HUBOT_BLUEMIX_AUDIT_DISABLED is not set to true`
		);
		return;
	}

	robot.logger.info(`${TAG}: Elasticsearch initialized for usage information.`);
	esClient = getClient();
}

/*
 * Initialize elastic search so that the bot activity docs can be added to it.
 */
function initBotActivity(robot) {

	if (!robot.brain.get(ACTIVITY_INITIALIZED)) {

		initElasticsearch(robot);
		robot.brain.set(ACTIVITY_INITIALIZED, true);

	}
}

module.exports = {
	BOTACTIVITY_INDEX_NAME: usage_index_name,
	BOTACTIVITY_DOC_TYPE: usage_doc_type,
	initBotActivity,
	getContainerUUID,
	getClient,
	clearClient
};
