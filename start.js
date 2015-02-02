#!/usr/bin/env node
var np = require('caf_netproxy');

np.run([module], function(err, top) {
           if (err) {
               console.log('Error: ' + err);
           } else {
               console.log('Starting HAProxy manager...');
           }
       });
