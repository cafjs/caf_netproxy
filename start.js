#!/usr/bin/env node
var np = require('./index.js');

np.run([module], process.env['PROXY_JSON'], function(err, top) {
           if (err) {
               console.log('Error: ' + err);
           } else {
               console.log('Starting HAProxy manager...');
               process.on('SIGTERM', function() {
                   console.log("Caught SIGTERM signal (stop container)");
                   top.__ca_graceful_shutdown__(null, function(err) {
                       console.log('shutdown:' + (err ?  err : 'OK'));
                   });
               });
           }
       });
