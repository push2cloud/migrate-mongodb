const _ = require('lodash');
const cf = require('push2cloud-cf-adapter');
const WF = require('push2cloud-workflow-utils');
const CFWF = require('push2cloud-cf-workflows');
const init = CFWF.init;

const waterfall = WF.waterfall;
const map = WF.map;
const step = WF.step;
const mapLimit = WF.mapLimit(4);

const migrate = (deploymentConfig, api, log) =>
  waterfall(
    [ init(deploymentConfig, api, log)

    , step(log('preparing local data structures'))
    , step(
      (services, cb) => cb(null, _.filter(services, (service) => service.type === (process.env.OLD_SERVICE_TYPE_NAME || 'mongodb')))
      , 'current.services'
      , 'migration.oldServices')

    , step((ctx, cb) => {
      cb(null, _.reduce(
        ctx.migration.oldServices
      , (serviceBindings, service) => {
        return _.concat(serviceBindings, _.filter(
            ctx.current.serviceBindings
          , (serviceBinding) => service.name === serviceBinding.service
        ));
      }
      , []));
    }, null, 'migration.oldServiceBindings')

    , step((services, cb) => {
      var newServices = _.map(services, (service) => {
        service.newName = service.name;
        service.name = `${service.name}-new`;
        service.type = process.env.NEW_SERVICE_TYPE_NAME || 'mongodb';
        return service;
      });
      cb(null, newServices);
    }, 'migration.oldServices', 'migration.newServices')


    , step((services, cb) => {
      cb(null, _.map(services, (service) => {
        return {
          name: `migrate-${service.name}`,
          disk: '512M',
          memory: '256M',
          instances: 1,
          healthCheckType: 'process',
          diego: true,
          enableSSH: true,
          dockerImage: 'push2cloud/migrate-mongodb:1.1.0',
          messages: [
            'MIGRATION SUCCESSFULL'
          ],
          failMessages: [
            'MIGRATION FAILED'
          ]
        };
      }));
    }, 'migration.oldServices', 'migration.apps')

    , step((services, cb) => {
      cb(null, _.map(services, (service) => {
        return {
          name: `migrate-${service.name}`,
          env: {
            fromService: `${service.name}`,
            toService: `${service.name}-new`,
            "OLD_SERVICE_TYPE_NAME": process.env.OLD_SERVICE_TYPE_NAME || 'mongodb',
            "NEW_SERVICE_TYPE_NAME": process.env.NEW_SERVICE_TYPE_NAME || 'mongodb',
          }
        };
      }));
    }, 'migration.oldServices', 'migration.envVars')

    , step((services, cb) => cb(null, _.concat(
        _.map(services, (service) => {
          return {
            app: `migrate-${service.name}`,
            service: `${service.name}`
          };
        }),
        _.map(services, (service) => {
          return {
            app: `migrate-${service.name}`,
            service: `${service.name}-new`
          };
        })
    )), 'migration.oldServices', 'migration.serviceBindings')

    , step(log('creating new service instances'))
    , mapLimit(api.createServiceInstance, 'migration.newServices')
    , map(api.waitForServiceInstance, 'migration.newServices')

    , step(log('preparing migration apps'))
    , map(api.createApp, 'migration.apps')
    , map(api.setEnv, 'migration.envVars')
    , map(api.bindService, 'migration.serviceBindings')

    , step(log('stopping current applications'))
    , map(api.stopApp, 'current.apps')

    , step(log('starting migration'))
    , map(api.startAppAndWaitForMessages, 'migration.apps')

    , step(log('deleting migration apps'))
    , map(api.stopApp, 'migration.apps')
    , map(api.unbindService, 'migration.serviceBindings')
    , map(api.deleteApp, 'migration.apps')

    , step(log('unbinding old services'))
    , map(api.unbindService, 'migration.oldServiceBindings')

    , step(log('renaming old services'))
    , step((services, cb) => cb(null, _.map(services, (service) => {
      service.newName = `${service.name}-old`;
      return service;
    })), 'migration.oldServices', 'migration.oldServices')
    , map(api.updateServiceInstance, 'migration.oldServices')
    , step((ctx, cb) => setTimeout(cb, 5000))
    , map(api.waitForServiceInstance, 'migration.oldServices')

    , step(log('renaming new services'))
    , map(api.updateServiceInstance, 'migration.newServices')
    , step((ctx, cb) => setTimeout(cb, 5000))
    , map(api.waitForServiceInstance, 'migration.newServices')

    , step(log('binding new services'))
    , step((serviceBindings, cb) => cb(null, _.map(serviceBindings, (serviceBinding) => {
      delete serviceBinding.serviceInstanceGuid
      return serviceBinding
    })), 'migration.oldServiceBindings', 'migration.oldServiceBindings')

    , map(api.bindService, 'migration.oldServiceBindings')

    , step(log('starting apps'))
    , map(api.startApp, 'current.apps')

    , step(log('done'))

    ]
 );


module.exports = function(config, log, cb) {
  const api = cf(_.assign({
    username: process.env.CF_USER
  , password: process.env.CF_PWD
  }
  , config.target));

  return migrate(config, api, log)({}, cb);
};
