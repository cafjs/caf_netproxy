#!/usr/bin/env node
'use strict';
var np = require('./index.js');

np.run([module], 'proxy-local.json', function(err) {
    if (err) {
        // eslint-disable-next-line
        console.log('Error: ' + err);
    } else {
        // eslint-disable-next-line
        console.log('Starting HAProxy manager...');
    }
});
