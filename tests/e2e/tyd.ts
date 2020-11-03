import * as _  from 'lodash';
import * as minimist from 'minimist';
import Launcher from '@wdio/cli'

// import logAndDie = require('./log-and-die');

// Nice!: https://github.com/f/omelette
// Maybe later: https://github.com/denoland/deno

const cmdLineArgs: any = minimist(process.argv.slice(2));

const args = {
  ...cmdLineArgs,
  // specs: ['tests/e2e/specs/manual.2browsers.test.ts'],
};

const isWatchMode = false;

const wdio = new Launcher('./wdio.conf.js', args, isWatchMode);

wdio.run().then((code) => {
  process.exit(code);
}, (error) => {
  console.error(`Launcher from @wdio/cli couldn't start test`, error.stacktrace);
  process.exit(1);
});

