import * as _  from 'lodash';
import * as minimist from 'minimist';
import Launcher from '@wdio/cli'
import * as glob from 'glob';
import { die, dieIf, logMessage, logMessageIf, logErrorIf, logUnusual
            } from '../tests/e2e/utils/log-and-die';
import { ChildProcess, spawn as _spawnAsync, spawnSync as _spawnSync } from 'child_process';


// Nice!: https://github.com/f/omelette
// or?: https://github.com/mattallty/Caporal.js
// (There's also:  https://github.com/mklabs/tabtab but abandoned?)
// Maybe later: https://github.com/denoland/deno

// Commands to support?:
//
//   this:  s/tyd server up
//   does:  make watch & ; s/d up  ?
//   (how termiate watch when exiting up ?)
//
//   this:  s/tyd nodejs yarn add glob
//   does:  s/d run --rm nodejs yarn add glob
//
//   this:  s/tyd playcli
//   starts the SBT REPL for Ty's Play Framework app server
//
//   this:  s/tyd e2e all
//   runs all end-to-end tests
//
//   this:  s/tyd e2e idpauth
//   runs all end-to-end tests for auth at external IDP (e.g. Keycloak or Gmail)
//
// Test traits:
//  1br, 2br, 3br,  b3c  mgt   idpauth  extreq-goog-fb-lin-githb-gitlb-twtr


//function spawnInBackground(cmd: string, args: string[], how?: 'Detach' | 'InForeground') {
function spawnInBackground(cmd: St, args: St[]): ChildProcess {
  console.log(`Spawn:  ${cmd} ${args.join(' ')}`);
  //if (how === 'Detach') {
    return _spawnAsync(cmd, args, { detached: true, stdio: 'inherit' });
  //}
  /*
  else if (how === 'InForeground') {
    // stdio 'inherit' makes the child process write directly to our stdout,
    // so colored output and CTRL+C works.
    _spawnSync(cmd, args, { stdio: 'inherit' });
  }
  else {
    die('TyE40MRSKT2');
  }*/
}


function spawnInForeground(cmd: St, args: St[]) {
  console.log(`Spawn fg:  ${cmd} ${args.join(' ')}`);
  // stdio 'inherit' makes the child process write directly to our stdout,
  // so colored output and CTRL+C works.
  _spawnSync(cmd, args, { stdio: 'inherit' });
}



// Skip the firts two, argv[1] = /usr/bin/node  argv[2] = <path-to-repo>/s/tyd.
const cmdLineArgs: any = minimist(process.argv.slice(2));
 
const mainCmd = process.argv[2];
const subCmd = process.argv[3];

console.log(`cmdLineArgs: ${JSON.stringify(cmdLineArgs)}`);
console.log(`process.argv: ${JSON.stringify(process.argv)}`);



if (mainCmd === 'justwatch') {
  spawnInForeground('make', ['watch']); // 'InForeground');
}

if (mainCmd === 'watchup') {
  const watchChildProcess = spawnInBackground('make', ['watch']);
  // RACE BUG when starting, we'll run  logs -f  too soon,
  // before any containers have started. Seems it then exits and
  // shuts down  watch & the log tailing.
  spawnInBackground('docker-compose', ['up', '-d']);
  spawnInForeground('docker-compose', ['logs', '-f', '--tail', '0']);
  watchChildProcess.kill();
  // But don't shut down the Ty server? That'd be annoying?
  // For that, use s/tyd kill
  process.exit(0);
}

if (mainCmd === 'kill') {
  spawnInForeground('make', ['dead']);
  process.exit(0);
}

if (mainCmd === 'make') {
  switch (subCmd) {
    case 'dev-images': // fall through
    case 'prod-images':
      spawnInForeground('make', [subCmd]); // , 'InForeground');
      break;
    default:
      die(`Make what? [TyE96RKT2]`);
  }
  process.exit(0);
}

if (mainCmd !== 'e2e') {
  console.error(`Werid main command: ${mainCmd}. Error. Bye.  [TyE30598256]`);
  process.exit(1);
}


const e2eSpecsPattern = `tests/e2e/specs/${'*' + (subCmd || '') + '*.ts' }`;

const allMatchingSpecs = glob.sync(e2eSpecsPattern, {});

console.log(`Specs pattern: ${e2eSpecsPattern}`);
console.log(`Specs matching:\n - ${allMatchingSpecs.join('\n - ')}`);


// Can look at node_modules/@wdio/cli/build/launcher.js  to see
// ex of how handle async errs?
async function runE2eTests(): Promise<Nr> {
  let zeroOrFirstErrorCode: U | Nr;

  // Command line arguments and the test runners?
  //
  // It seems the Wdio test runner child processes we launch here inherit our
  // command line incl arguments, and same working dir — in local-runner, there's
  // fork() with: { cwd: process.cwd(), env: runnerEnv, execArgv: this.execArgv },
  // see: ../node_modules/@wdio/local-runner/build/worker.js

  async function specsMatching(testTypes: St[], run: (specs: St[]) => Promise<Nr>) {
    dieIf(!testTypes?.length, 'TyE38590RTK');
    let specsNow = allMatchingSpecs;
    for (let tt of testTypes) {
      specsNow = specsNow.filter((fileName: St) => {
        // 0 like Nothing, Not, Skip, Exclude. But '!' would need to be shell
        // escaped, one needs to type '\!', right? An extra char, how boring.
        const shallInclude = tt[0] !== '0';
        const matchesType = fileName.indexOf(`.${tt}.`) >= 0;
        return matchesType === shallInclude;
      });
    }
    if (specsNow.length) {
      const sep = '\n - ';
      const what = '.' + testTypes.join('.');
      logMessage(`Running ${what} specs:${sep}${specsNow.join[sep]}`);
      const exitCode = await run(specsNow);
      if (!zeroOrFirstErrorCode) {
        zeroOrFirstErrorCode = exitCode;
      }
      logErrorIf(exitCode !== 0, `ERROR exit code ${exitCode} from:  ${what}`);
      logMessageIf(exitCode === 0, `Done, fine, exit code 0 from:  ${what}`);
    }
  }

  //DUPL CODE for now [DUPWDIOCNF]

  // Run all variants (e.g. 1br, 2br, 3br) — so we'll find all failing tests
  // without having to restart over and over again:
  //
  // Depending on which e2e tests to run, amend `args` so we'll use the
  // correct capabilities and static files help server.
  //
  // `args` gets merged into the WebdriverIO.Config returned by wdio.conf.ts.
  // So, args.specs gest aded to? overrides? the config.spec in wdio.conf.ts.

  await specsMatching(['1br'], async (specs: St[]): Promise<Nr> => {
    const args = { specs }
    const wdio = new Launcher('./tests/e2e/wdio.conf.js', args);
    return wdio.run();
  });

  await specsMatching(['2br'], async (specs: St[]): Promise<Nr> => {
    die('2br not impl [TyE390DRETSK2]')
    const args = { specs }
    const wdio = new Launcher('./tests/e2e/wdio.conf.js', args);
    return await wdio.run();
  });

  await specsMatching(['3br'], async (specs: St[]): Promise<Nr> => {
    die('3br not impl [TyE390DRETSK3]')
    const args = { specs }
    const wdio = new Launcher('./tests/e2e/wdio.conf.js', args);
    return await wdio.run();
  });

  return zeroOrFirstErrorCode;
}


console.log(`Running e2e tests ...`);

runE2eTests().then((code) => {
  const fineOrFailed = code === 0 ? 'fine' : 'tests FAILED';
  console.log(`Done running e2e tests, exit code: ${code}, ${fineOrFailed}`);
  logErrorIf(code === undefined, `Error: Didn't run any tests at all [TyE0SPECSRUN]`);
  process.exit(code);
}, (error) => {
  console.error(`Error starting tests [TyEE2ESTART]`, error.stacktrace);
  process.exit(1);
});
