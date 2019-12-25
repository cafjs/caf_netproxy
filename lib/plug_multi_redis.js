/*!
Copyright 2013 Hewlett-Packard Development Company, L.P.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
'use strict';
/**
 * Manages multiple redis backends for node discovery.
 *
 *
 * @name plug_multi_redis
 * @namespace
 * @augments caf_components/gen_dynamic_container
 */

var assert = require('assert');
var caf_core = require('caf_core');
var caf_comp = caf_core.caf_components;

var async = caf_comp.async;
var myUtils = caf_comp.myUtils;
var genDynamicContainer = caf_comp.gen_dynamic_container;

/**
 * Factory method to create a plug to  manage available nodes so that CAs are
 * unique in the data center.
 *
 *  @see  caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        // port-> Array.<string> (app names)
        var redisLUT = {};

        var that = genDynamicContainer.constructor($, spec);
        $._.$.log && $._.$.log.debug('New multi redis plug');

        assert.equal(typeof spec.env.__redis_json__, 'string',
                     "'spec.env.__redis_json__' is not a string");

        assert.equal(typeof spec.env.redisHostname, 'string',
                     "'spec.env.redisHostname' is not a string");

        var super__ca_instanceChild__ = myUtils
            .superior(that, '__ca_instanceChild__');

        /**
         *  Creates a Redis client instance or finds a reference to an
         * existing local one.
         *
         * @param {Object=} data An optional hint on how to add the child.
         * @param {Object} specEnv An extra child description to override a
         * default one. At a minimum `specEnv.name` should define the name
         * for this CA
         * @param {caf.cb} cb A callback to return an error if I cannot
         * create the CA.
         *
         * @name plug_multi_nodes#__ca_instanceChild__
         * @function
         */
        that.__ca_instanceChild__ = function(data, specEnv, cb0) {
            try {
                assert.equal(typeof(specEnv.name), 'string',
                             "'specEnv.name' is not a string");
                var desc = $._.$.loader
                    .__ca_loadDescription__(spec.env.__redis_json__, true,
                                            specEnv);
                super__ca_instanceChild__(data, desc, cb0);
            } catch (err) {
                cb0(err);
            }
        };

        var toLUT = function(allRedisPorts) {
            var redisLUT = {};
            Object.keys(allRedisPorts).forEach(function(x) {
                var port = allRedisPorts[x];
                var apps = redisLUT[port];
                apps = (apps ? apps : []);
                apps.push(x);
                redisLUT[port] = apps;
            });
            return redisLUT;
        };

        var logErrorAndContinue = function(cb0) {
            return function(err, data) {
                if (err) {
                    $._.$.log && $._.$.log.debug('Ignoring error' +
                                                 myUtils.errToPrettyStr(err));
                    cb0(null, data);
                } else {
                    cb0(err, data);
                }
            };
        };

        var createRedis = function(cb0) {
            async.map(Object.keys(redisLUT), function(x, cb1) {
                if (!that.$[x]) {
                    var specEnv = {
                        name: x,
                        env: {
                            redis: {
                                password: null,
                                hostname: spec.env.redisHostname,
                                port: parseInt(x)
                            }
                        }
                    };
                    that.__ca_instanceChild__(null, specEnv,
                                              logErrorAndContinue(cb1));
                } else {
                    cb1(null);
                }
            }, cb0);
        };

        var listAllNodes = function(cb0) {
            var ports = Object.keys(redisLUT);

            var matchPrefix = function(id, validApps) {
                return validApps.some(function(validApp) {
                    return (id.indexOf(validApp) === 0);
                });
            };

            var filterNodes = function(err, nodesArray) {
                if (err) {
                    cb0(err);
                } else {
                    var results = {};
                    nodesArray.forEach(function(x, i) {
                        if (x && (typeof x === 'object')) {
                            var validApps = redisLUT[ports[i]];
                            var res = Object.keys(x).filter(function(app) {
                                return matchPrefix(app, validApps);
                            });
                            res.forEach(function(app) {
                                results[app] = x[app];
                            });
                        }
                    });
                    $._.$.log && $._.$.log.debug(results);
                    cb0(null, results);
                }
            };
            async.map(ports, function(x, cb1) {
                if (that.$[x]) {
                    that.$[x].listNodes(null, logErrorAndContinue(cb1));
                } else {
                    cb1(null);
                }
            }, filterNodes);
        };

        /**
         *
         * @see caf_redis#plug_checkpoint
         *
         */
        that.listNodes = function(_ignore, cb0) {
            redisLUT = toLUT($._.$.deploy.__ca_getAllRedisPorts__());
            $._.$.log && $._.$.log.debug(redisLUT);
            createRedis(function(err) {
                if (err) {
                    cb0(err);
                } else {
                    listAllNodes(cb0);
                }
            });
        };

        cb(null, that);
    } catch (err) {
        cb(err);
    }
};
