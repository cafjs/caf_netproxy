#!/usr/bin/env node
'use strict';
var np = require('./index.js');

np.run([module], process.env['PROXY_JSON'], function(err, top) {
    if (err) {
        // eslint-disable-next-line
        console.log('Error: ' + err);
    } else {
        // eslint-disable-next-line
        console.log('Starting HAProxy manager...');
        process.on('SIGTERM', function() {
            // eslint-disable-next-line
            console.log('Caught SIGTERM signal (stop container)');
            top.__ca_graceful_shutdown__(null, function(err) {
                // eslint-disable-next-line
                console.log('shutdown:' + (err ? err : 'OK'));
            });
        });
    }
});
