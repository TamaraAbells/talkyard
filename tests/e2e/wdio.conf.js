
// Before:  (what did this do? Who cares)
// require('ts-node/register')

require('ts-node').register({
      transpileOnly: true,
      compilerOptions : {
        // Without this, ts-node apparently transpiles to ES2015,
        // causing this error:
        //   > TypeError: Class constructor WDIOReporter cannot be invoked without 'new'
        // See:
        // https://stackoverflow.com/questions/51860043/
        //    javascript-es6-typeerror-class-constructor-client-cannot-be-invoked-without-ne
        target: 'ES2017',
      },
    });

// Include the '.ts' suffix, otherwise apparently any '.js' file with the same
// name (excl suffix) gets loaded.
exports.config = require('./wdio.conf.ts');
