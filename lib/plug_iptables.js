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
"use strict";
/**
 * A plug to forward ports using iptables.
 *
 * @name plug_iptables
 * @namespace
 * @augments  caf_components/gen_plug
 */
var assert = require('assert');
var fs = require('fs');
var dns = require('dns');
var os = require('os');
var caf_comp = require('caf_components');
var async = caf_comp.async;
var myUtils = caf_comp.myUtils;
var genPlug = caf_comp.gen_plug;
var mustache = require('mustache');


/**
 * Factory method to create a lease plugin.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {

        var last = [];
        var loc = os.networkInterfaces();
        var that = genPlug.constructor($, spec);
        assert.equals(typeof spec.env.templateFile,
                      'string', "'spec.env.templateFile' is not a string");

        var template = fs.readFileSync(spec.env.templateFile,
                                       {encoding: 'utf8'});
        mustache.parse(template);

        var checkLocal = function(hostname, cb0) {
            var matchIP = function(ip) {
                return Object.keys(loc)
                    .some(function(key) {
                              var val = loc[key];
                              return val
                                  .some(function(p) {
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

        var updateRules = function(all) {
            async.filter(all, function(hostPort, cb0) {
                             var p = hostPort.split(':');
                             checkLocal(p[0], function(err, isLocal) {
                                            if (err) {
                                                console.log("Can't resolve " +
                                                            p[0] + ' ignoring');
                                                cb0(false);
                                            } else {
                                                cb0(isLocal);
                                            }
                                        });
                         }, function(results) {
                             var vals = {
                                 nodes: []
                             };
                             results.forEach(function(x) {
                                                 var p = x.split(':');
                                                 var q = $._.$.nodes[x]
                                                     .split(':');
                                                 var r = {
                                                     localHost : p[0],
                                                     localPort : parseInt(p[1]),
                                                     remoteHost : q[0],
                                                     remotePort : parseInt(q[1])
                                                 };
                                                 vals.nodes.push(r);
                                             });
                             mustache.render(template, vals);
                         });
        };

        var sync = function(newVersion) {
            if (!that.__ca_isShutdown__) {
                var all = Object.keys($._.$.nodes)
                    .filter(function(x) {
                                return (x !== $._.$.nodes.getNodeId());
                            })
                    .sort();
                if (!myUtils.deepEqual(all, last)) {
                    updateRules(all);
                    last = all;
                }
            }

        };

        $._.$.nodes.onChange(sync);


        cb(null, that);
    } catch (err) {
        cb(err);
    }
};
