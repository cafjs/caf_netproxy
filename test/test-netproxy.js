var async = require('async');
var caf_comp = require('caf_components');
var myUtils = caf_comp.myUtils;
var json_rpc = require('caf_transport').json_rpc;
var WebSocket = require('ws');
var fs = require('fs');

var hello = require('./hello/main.js');

var app = hello;

var HOST='localhost';
var PORT=3000;

process.on('uncaughtException', function (err) {
               console.log("Uncaught Exception: " + err);
               console.log(myUtils.errToPrettyStr(err));
               process.exit(1);

});

var checkIp = function(test, ip, n) {
    var p = fs.readFileSync('/tmp/haproxy.cfg', {encoding: 'utf8'});
    test.equals(p.split(ip).length, n+1);
};

module.exports = {
    setUp: function (cb) {
        var self = this;
        async.series([
                         function(cb1) {
                             app.load(null, {name: 'top'}, 'framework.json',
                                      null, function(err, $) {
                                          if (err) {
                                              console.log('setUP Error' + err);
                                              console.log('setUP Error $' + $);
                                              cb1(null);
                                          } else {
                                              self.$ = $;
                                              self.ws = new WebSocket('ws://'+
                                                                      HOST +
                                                                      ':' +
                                                                      PORT);
                                              self.ws.on('open', function() {
                                                             cb1(err, $);
                                                         });
                                          }
                                      });
                         },
                          function(cb1) {
                              app.loadProxy(function(err, proxy) {
                                                if (err) {
                                                    console.log('proxy Error' +
                                                                err);
                                                    cb1(err);
                                                } else {
                                                    self.proxy = proxy;
                                                    cb1(null, proxy);
                                                }
                                            });
                          }
                     ], cb);
    },
    tearDown: function (cb) {
        var self = this;
        async.series([
                         function(cb1) {
                             if (!self.$) {
                                 cb1(null);
                             } else {
                                 self.ws.close();
                                 self.ws.removeAllListeners();
                                 self.$.top.__ca_graceful_shutdown__(null, cb1);
                             }
                         },
                         function(cb1) {
                             if (self.proxy) {
                                 self.proxy.__ca_graceful_shutdown__(null, cb1);
                             } else {
                                 cb1(null);
                             }
                         }
                     ], cb);
    },
    helloworld: function (test) {
        var self = this;

        test.expect(6);
        async.series([
                         function(cb) {
                             setTimeout(function() {
                                            cb(null);
                                        }, 10000);
                         },
                         function(cb) {
                             setTimeout(function() {
                                            checkIp(test, 'localhost:3000', 2);
                                            cb(null);
                                        }, 2000);
                         },
                         function(cb) {
                             process.env['VCAP_APP_PORT']="3001";
                             app.load(null, {name: 'top'}, 'framework.json',
                                      null, function(err, $) {
                                          if (err) {
                                              console.log('setUP Error' + err);
                                              console.log('setUP Error $' + $);
                                              cb(null);
                                          } else {
                                              self.$2 = $;
                                              setTimeout(function() {
                                                             cb(null, $);
                                                         }, 10000);
                                          }
                                      });
                         },
                         function(cb) {
                             checkIp(test, 'localhost:3000', 2);
                             checkIp(test, 'localhost:3001', 2);
                             cb(null);
                         },
                         function(cb) {
                             if (!self.$2) {
                                 cb(null);
                             } else {
                                 self.$2.top.__ca_graceful_shutdown__(null, cb);
                             }
                         },
                         function(cb) {
                             setTimeout(function() {
                                            checkIp(test, 'localhost:3000', 2);
                                            checkIp(test, 'localhost:3001', 0);
                                            cb(null);
                                        }, 10000);
                         }

                     ], function(err, res) {
                         test.ifError(err);
                         test.done();
                     });
    }
};
