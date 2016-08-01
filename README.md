
[![Dependency Status](https://dependencyci.com/github/ibm-cloud-solutions/hubot-ibmcloud-alerts/badge)](https://dependencyci.com/github/ibm-cloud-solutions/hubot-ibmcloud-alerts)
[![npm](https://img.shields.io/npm/v/hubot-ibmcloud-alerts.svg?maxAge=2592000)](https://www.npmjs.com/package/hubot-ibmcloud-alerts)

# hubot-ibmcloud-alerts

A hubot script that allows monitoring of applications and enabling alerts

## Getting Started
* [Usage](#usage)
* [Commands](#commands)
* [Hubot Adapter Setup](#hubot-adapter-setup)
* [Development](#development)
* [License](#license)
* [Contribute](#contribute)

## Usage

Steps for adding this to your existing hubot:

1. `cd` into your hubot directory
2. Install the app management functionality with `npm install hubot-app-management --save`
3. Add `hubot-app-management` to your `external-scripts.json`
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
- `hubot app help` - Show available commands for app management.
- `hubot app delete [app]` - Delete an app.
- `hubot app list` - List apps.
- `hubot app logs [app]` - Show logs for an app.
- `hubot app restage [app]` - Restage an app.
- `hubot app scale [app] [num]` - Scale app to a number of instances.
- `hubot app start [app]` - Start an app.
- `hubot app status [app]` - Get status for an app.
- `hubot app stop [app]` - Stop an app.

## Hubot Adapter Setup

Hubot supports a variety of adapters to connect to popular chat clients.  For more feature rich experiences you can setup the following adapters:
- [Slack setup](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-alerts/blob/master/docs/adapters/slack.md)
- [Facebook Messenger setup](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-alerts/blob/master/docs/adapters/facebook.md)

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