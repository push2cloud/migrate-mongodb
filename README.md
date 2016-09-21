# migrate mongodb
The contents of this repo allow for an easy migration of MongoDB service instances using a custom Docker Image and Push2Cloud Workflow.

Note: this workflow creates service instances that might incur additional cost.

## How to / TL;DR
```
git clone https://github.com/push2cloud/migrate-mongodb.git
cd migrate-mongodb
vi deploymentConfig.json # Edit target to fit your deployment
npm install # install push2cloud dependencies
DEBUG=* ./node_modules/.bin/p2c exec ./workflow/migrate.js
```

## Details!
The workflow performs the following steps for you:
1. Create all the required Push2Cloud data structures
2. Create new service instances (same plan is used)
3. Create migration apps, configure via environment variables
4. Stops all applications in configured space
5. Starts migration apps and waits for completion/failure
6. Stops and deletes migration apps
7. Renames old service instances to ${name}-old
8. Renames new serivce instances to their proper name
9. Starts all apps again

## Migration app
The migration application is a custom Docker image that runs `migrate.sh` on startup. The docker container must be configured via the two environment variables `fromService` and `toSerivice` (names of the CF service instances). `migrate.sh` performs a complete data migration between the configured services using `mongodb-dump` and the `mongo-restore`

## Customizing
This workflow is meant to be used as a base for your own custom migration workflows. You probably want to fine tune start/stop behaviour to your liking. Open an Issue if you have questions on how to achieve certain things.
