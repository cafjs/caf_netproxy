var caf_core =  require('caf_core');
var caf_comp = caf_core.caf_components;
var caf_platform = caf_core.caf_platform;

var np = require('../../index.js');

exports.load = function($, spec, name, modules, cb) {
    modules = modules || [];
    modules.push(module);
    modules.push(caf_platform.getModule());

    caf_comp.load($, spec, name, modules, cb);
};

exports.loadProxy = function(cb) {
    var modules = [];
    modules.push(module);
    modules.push(np.getModule());

    np.run(modules, 'proxy-local-nossl.json', function(err, top) {
               if (err) {
                   console.log('Error: ' + err);
               } else {
                   console.log('Starting HAProxy manager...');
               }
               cb(err, top);
           });
};
