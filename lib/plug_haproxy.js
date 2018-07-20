/*!
Copyright 2014 Hewlett-Packard Development Company, L.P.

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
 * A plug to forward ports and route based on host by using HAProxy.
 *
 * @name plug_haproxy
 * @namespace
 * @augments  caf_components/gen_plug
 */
var assert = require('assert');
var fs = require('fs');
var dns = require('dns');
var os = require('os');
var caf_core = require('caf_core');
var caf_comp = caf_core.caf_components;
var async = caf_comp.async;
var myUtils = caf_comp.myUtils;
var genPlug = caf_comp.gen_plug;
var mustache = require('mustache');
var execFile = require('child_process').execFile;
var path = require('path');

/**
 * Factory method to create a HAProxy plugin.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {

        var loc = os.networkInterfaces();
        var that = genPlug.constructor($, spec);
        assert.equal(typeof spec.env.templateFile,
                      'string', "'spec.env.templateFile' is not a string");
        var templateFile = path.resolve(__dirname, spec.env.templateFile);

        var template = fs.readFileSync(templateFile, {encoding: 'utf8'});
        mustache.parse(template);

        assert.equal(typeof spec.env.targetFile,
                      'string', "'spec.env.targetFile' is not a string");

        assert.equal(typeof spec.env.pidFile,
                      'string', "'spec.env.pidFile' is not a string");

        assert.equal(typeof spec.env.reloadScript,
                      'string', "'spec.env.reloadScript' is not a string");

        assert.equal(typeof spec.env.checkLocalIP, 'boolean',
                      "'spec.env.checkLocalIP' is not a boolean");

        if (spec.env.localhostPort) {
            assert.equal(typeof spec.env.localhostPort, 'number',
                         "'spec.env.localhostPort' is not a number");
        }

        var checkLocal = function(hostname, cb0) {
            var matchIP = function(ip) {
                return Object.keys(loc)
                    .some(function(key) {
                        var val = loc[key];
                        return val.some(function(p) {
                            if (p.address === ip) {
                                return true;
                            } else {
                                return false;
                            }
                        });
                    });
            };
            dns.lookup(hostname, function(err, ip) {
                if (err) {
                    cb0(err);
                } else {
                    cb0(err, matchIP(ip));
                }
            });
        };

        var findNodes = function(cb0) {
            var all = Object.keys($._.$.nodes.$);
            if (spec.env.checkLocalIP) {
                async.filter(all, function(hostPort, cb1) {
                    var p = hostPort.split(':');
                    checkLocal(p[0], function(err, isLocal) {
                        if (err) {
                            var m = "Can't resolve " +
                                                        p[0] + ' ignoring';
                            $._.$.log &&
                                                        $._.$.log.debug(m);
                            cb1(false);
                        } else {
                            cb1(isLocal);
                        }
                    });
                }, function(results) {
                    cb0(null, results);
                });
            } else {
                cb0(null, all);
            }
        };

        var renderTemplate = function(nodes, cb0) {
            /*
             * Input template is of the form:
             *
             * { "ports" : [ <PortType>], "apps" : [ <AppType>] }
             *
             * and PortType:
             *
             * {"name": string, "localPort": number, "remoteTarget" : string}
             *
             * 'name' is an arbitrary identifier, mostly for logging.
             * 'remoteTarget' is of the form `host:port`
             *
             * AppType is of the form:
             *
             * {"appName": string, "target" : [<PortType>]}
             *
             *
             * To simplify the template `remoteTargets` are duplicated, i.e.,
             *  the top level field 'ports' contains all the targets that we
             *  want to (tcp) forward to, that could also be targets for some
             *  application http routing.
             *
             */
            var apps = {};
            var count = 0;
            nodes.forEach(function(x) {
                var p = x.split(':');
                var appName = p[0];
                var name = 'p_' + count;
                count = count + 1;
                var r = {
                    name: name,
                    localPort: parseInt(p[1]),
                    remoteTarget: $._.$.nodes.$[x]
                };
                apps[appName] = apps[appName] || [];
                apps[appName].push(r);
            });
            var ports = [];
            Object.keys(apps).forEach(function(x) {
                ports = ports.concat(apps[x]);
            });
            var appsArray = [];

            Object.keys(apps).forEach(function(x) {
                var p = {
                    appName: x,
                    target: apps[x]
                };
                appsArray.push(p);
            });

            var dataArgs = (spec.env.localhostPort ? // port 0 invalid
                        {ports: ports, apps: appsArray,
                         localhostPort: spec.env.localhostPort} :
                        {ports: ports, apps: appsArray});
            var r = mustache.render(template, dataArgs);
            fs.writeFile(spec.env.targetFile, r, function(err, data) {
                cb0(err, data || null);
            });
        };

        var reloadHAProxy = function(_ignore, cb0) {
            var file = path.resolve(__dirname, spec.env.reloadScript);
            execFile(file, [spec.env.targetFile, spec.env.pidFile],
                     function(err, stdout, stderr) {
                         $._.$.log &&
                             $._.$.log.debug('stdout: ' + stdout);
                         $._.$.log &&
                             $._.$.log.debug('stderr: ' + stderr);
                         cb0(err, stdout);
                     });
        };

        var updateRules = function() {
            async.waterfall([
                findNodes,
                renderTemplate,
                reloadHAProxy
            ], function(err) {
                if (err) {
                    $._.$.log &&
                                        $._.$.log
                                        .error('Cannot update HAProxy:' +
                                               myUtils.errToPrettyStr(err));
                }
            });
        };

        $._.$.nodes.onChange(function(newVersion) {
            $._.$.log &&
                                     $._.$.log.debug('HAProxy: updating: ' +
                                                     newVersion);
            if (!that.__ca_isShutdown__) {
                updateRules();
            }
        });

        updateRules();
        cb(null, that);
    } catch (err) {
        cb(err);
    }
};
