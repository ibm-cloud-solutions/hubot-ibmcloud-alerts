[![Build Status](https://travis-ci.org/ibm-cloud-solutions/hubot-ibmcloud-alerts.svg?branch=master)](https://travis-ci.org/ibm-cloud-solutions/hubot-ibmcloud-alerts)
[![Coverage Status](https://coveralls.io/repos/github/ibm-cloud-solutions/hubot-ibmcloud-alerts/badge.svg?branch=master)](https://coveralls.io/github/ibm-cloud-solutions/hubot-ibmcloud-alerts?branch=master)
[![Dependency Status](https://dependencyci.com/github/ibm-cloud-solutions/hubot-ibmcloud-alerts/badge)](https://dependencyci.com/github/ibm-cloud-solutions/hubot-ibmcloud-alerts)
[![npm](https://img.shields.io/npm/v/hubot-ibmcloud-alerts.svg?maxAge=2592000)](https://www.npmjs.com/package/hubot-ibmcloud-alerts)

# hubot-ibmcloud-alerts

A hubot script that allows monitoring of applications and enabling alerts

## Getting Started
* [Usage](#usage)
* [Commands](#commands)
* [Hubot Adapter Setup](#hubot-adapter-setup)
* [Cognitive Setup](#cognitive-setup)
* [Development](#development)
* [License](#license)
* [Contribute](#contribute)

## Usage

Steps for adding this to your existing hubot:

1. `cd` into your hubot directory
2. Install the app management functionality with `npm install hubot-ibmcloud-alerts --save`
3. Add `hubot-ibmcloud-alerts` to your `external-scripts.json`
4. Add the necessary environment variables:
```
export HUBOT_BLUEMIX_API=<Bluemix API URL>
export HUBOT_BLUEMIX_ORG=<Bluemix Organization>
export HUBOT_BLUEMIX_SPACE=<Bluemix space>
export HUBOT_BLUEMIX_USER=<Bluemix User ID>
export HUBOT_BLUEMIX_PASSWORD=<Password for the Bluemix use>
```
5. Start up your bot & off to the races!

## Commands

- `hubot alert show|list` - Show status of alerting.
- `hubot alert me when cpu|memory|disk exceeds x%` - Enable resource alert and set threshold.
- `hubot alert turn on cpu|memory|disk|event|all` - Turns on alerts for specified resource.
- `hubot alert turn off cpu|memory|disk|event|all` - Turns off alerts for specified resource.
- `hubot alert change cpu|memory|disk threshold to x%` - Sets alert threshold for specified resource.
- `hubot alert me when app events happen` - Enable alerts when events happen for any app in the active space.
- `hubot app show me problems [today|this week]` - Show top 5 most problematic apps [today|this week] in the active space.

## Hubot Adapter Setup

Hubot supports a variety of adapters to connect to popular chat clients.  For more feature rich experiences you can setup the following adapters:
- [Slack setup](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-alerts/blob/master/docs/adapters/slack.md)
- [Facebook Messenger setup](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-alerts/blob/master/docs/adapters/facebook.md)

## Cognitive Setup

This project supports natural language interactions using Watson and other Bluemix services.  For more information on enabling these features, refer to [Cognitive Setup](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-nlc/blob/master/docs/cognitiveSetup.md).

## Development

Please refer to the [CONTRIBUTING.md](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-alerts/blob/master/CONTRIBUTING.md) before starting any work.  Steps for running this script for development purposes:

### Configuration Setup

1. Create `config` folder in root of this project.
2. Create `env` in the `config` folder, with the following contents:
```
export HUBOT_BLUEMIX_API=<Bluemix API URL>
export HUBOT_BLUEMIX_ORG=<Bluemix Organization>
export HUBOT_BLUEMIX_SPACE=<Bluemix space>
export HUBOT_BLUEMIX_USER=<Bluemix User ID>
export HUBOT_BLUEMIX_PASSWORD=<Password for the Bluemix use>
```
3. In order to view content in chat clients you will need to add `hubot-ibmcloud-formatter` to your `external-scripts.json` file. Additionally, if you want to use `hubot-help` to make sure your command documentation is correct. Create `external-scripts.json` in the root of this project
```
[
    "hubot-help",
    "hubot-ibmcloud-formatter"
]
```
4. Lastly, run `npm install` to obtain all the dependent node modules.

### Running Hubot with Adapters

Hubot supports a variety of adapters to connect to popular chat clients.

If you just want to use:
 - Terminal: run `npm run start`
 - [Slack: link to setup instructions](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-alerts/blob/master/docs/adapters/slack.md)
 - [Facebook Messenger: link to setup instructions](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-alerts/blob/master/docs/adapters/facebook.md)

## License

See [LICENSE.txt](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-alerts/blob/master/LICENSE.txt) for license information.

## Contribute

Please check out our [Contribution Guidelines](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-alerts/blob/master/CONTRIBUTING.md) for detailed information on how you can lend a hand.
