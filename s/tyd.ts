import * as _  from 'lodash';
import * as minimist from 'minimist';
import Launcher from '@wdio/cli'
import * as glob from 'glob';
import { die, dieIf, logMessage, logMessageIf, logError, logErrorIf, logUnusual
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

type ExitCode = Nr | Nl;


function spawnInBackground(cmdMaybeArgs: St, anyArgs?: St[]): ChildProcess { // , opts: { pipeStdIn?: Bo } = {})
  let cmd = cmdMaybeArgs;
  let args = anyArgs;

  if (_.isUndefined(args)) {
    const cmdAndArgs = cmdMaybeArgs.split(' ').filter(v => !!v.trim());
    cmd = cmdAndArgs[0];
    args = cmdAndArgs.slice(1);
  }

  console.log(`\NSPAWN BG:  ${cmd} ${args.join(' ')}\n`);
  //const stdio = opts.pipeStdIn ? ['pipe', process.stdout, process.stderr] : 'inherit';
  const childProcess = _spawnAsync(cmd, args, { detached: true, stdio: 'inherit' });
  //childProcess.stdout.pipe(process.stdout);
  return childProcess;
}


function spawnInForeground(cmdMaybeArgs: St, anyArgs?: St[]): ExitCode {
  let cmd = cmdMaybeArgs;
  let args = anyArgs;

  if (_.isUndefined(args)) {
    const cmdAndArgs = cmdMaybeArgs.split(' ').filter(v => !!v.trim());
    cmd = cmdAndArgs[0];
    args = cmdAndArgs.slice(1);
  }

  console.log(`\nSPAWN FG:  ${cmd} ${args.join(' ')}\n`);
  // stdio 'inherit' makes the child process write directly to our stdout,
  // so colored output and CTRL+C works.
  const result = _spawnSync(cmd, args, { stdio: 'inherit' });
  return result.status;
}



// Skip the firts two, argv[1] = /usr/bin/node  argv[2] = <path-to-repo>/s/tyd.
const cmdLineArgs: any = minimist(process.argv.slice(2));
 
const mainCmd = process.argv[2];
let mainCmdIsOk: U | true;
const manySubCmds = process.argv.slice(3); // drop the main command
const subCmd = manySubCmds[0];

console.log(`cmdLineArgs: ${JSON.stringify(cmdLineArgs)}`);
console.log(`process.argv: ${JSON.stringify(process.argv)}`);


if (mainCmd === 'ps') {
  spawnInForeground('docker-compose ps');
  process.exit(0);
}


if (mainCmd === 'l' || mainCmd === 'logslive') {
  spawnInForeground('docker-compose logs -f --tail 0');
  process.exit(0);
}


if (mainCmd === 'logsrecentlive') {
  spawnInForeground('docker-compose logs -f --tail 555');
  process.exit(0);
}


if (mainCmd === 'logsold') {
  spawnInForeground('docker-compose logs');
  process.exit(0);
}


if (mainCmd === 'nodejs') {
  spawnInForeground('docker-compose run --rm nodejs ' + manySubCmds.join(' '));
  process.exit(0);
}


if (mainCmd === 'justwatch') {
  spawnInForeground('make watch');
  process.exit(0);
}


if (mainCmd === 'u' || mainCmd === 'watchup') {
  mainCmdIsOk = true;

  // First, update assets bundles once in the foreground — it's annoying
  // if instead that's done while the server is starting, because then the server
  // might decide to stop and restart just to pick up any soon newly built bundles?
  // (Also, log messages from make and the app server get mixed up with each other.)
  spawnInForeground('docker-compose run --rm nodejs yarn install');
  spawnInForeground('make debug_asset_bundles');

  // Run `up -d` in foreground, so we won't start the `logs -f` process too soon
  // — that process would exit, if `up -d` hasn't yet started any containers.
  spawnInForeground('docker-compose up -d');

  // Now time to start rebuilding asset bundles in the background, when needed.
  const rebuildAssetsCmd = 'make watch';
  const watchChildProcess = spawnInBackground(rebuildAssetsCmd);

  const watchExitedPromise = new Promise<ExitCode>(function(resolve, reject) {
    watchChildProcess.once('exit', function(exitCode: ExitCode) {
      (makeShouldExit ? logMessage : logError)(
            `'${rebuildAssetsCmd}' exited, code: ${exitCode}`);
      resolve(exitCode);
    });
  })

  let makeShouldExit = false;

  // Don't exit immetiately on CTRL+C — first, stop  make watch.
  // But!  'make watch' uses inotifywait, which con't stop :-(
  // Maybe switch to https://github.com/paulmillr/chokidar  instead?
  // And watch client/  and app/  and ty-dao-rdb  and ty-core, call Make
  // on any change?
  process.on('SIGINT', function() {
    logMessage(`Caught SIGINT.`);
    // We'll continue after  spawnInForeground() below. (Need do nothing here.)
  });

  // Show logs until CTRL+C.
  // (There's also:  process.on('SIGINT', function() { ... });
  spawnInForeground('docker-compose logs -f --tail 0');

  logMessage(`Stopping '${rebuildAssetsCmd}' ...`);
  makeShouldExit = true;
  watchChildProcess.kill();

  setTimeout(function() {
    logError(`'${rebuildAssetsCmd}' takes long to exit, I'm quitting anyway, bye.`);
    process.exit(0);
  }, 9000);

  watchExitedPromise.finally(function() {
    logMessage(`Bye. Server maybe still running.`);
    process.exit(0);
  })
}


if (mainCmd === 'k' || mainCmd === 'kill') {
  spawnInForeground('make dead');
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


if (mainCmd === 'cleane2elogs') {
  spawnInForeground('rm -fr target/e2e-test-logs');
  spawnInForeground('mkdir target/e2e-test-logs');
  process.exit(1);
}


if (mainCmd === 'e2e') {

// -----------------------------------------------------------------------
//  E2E Tests  (move to other file?)
// -----------------------------------------------------------------------


//const e2eSpecsPattern = `tests/e2e/specs/${subCmd ? `*${subCmd}*.ts` : '*.ts'}`;
//const allMatchingSpecs_old = glob.sync(e2eSpecsPattern, {});

const allSpecs = glob.sync('tests/e2e/specs/*.ts', {});
let allMatchingSpecs: St[] = [...allSpecs];

for (let pattern of manySubCmds) {
  // Dupl filter (987RM29565W)
  allMatchingSpecs = allMatchingSpecs.filter((fileName: St) => {
    // '!' and '0' (like, Nothing, Not) means exclude those tests.
    // (0 is simpler to type on the command line, need not be escaped).
    const shallInclude = pattern[0] !== '0' && pattern[0] !== '!';
    const p = shallInclude ? pattern : pattern.substr(1, 999);  // drop any '!'
    const matchesType = fileName.indexOf(p) >= 0;
    return matchesType === shallInclude;
  });
}


console.log(`Specs patterns:  ${manySubCmds.join(' ')}`);
console.log(`Specs matching:\n - ${allMatchingSpecs.join('\n - ')}`);



// Can look at node_modules/@wdio/cli/build/launcher.js  to see
// ex of how handle async errs?
//
async function runE2eTests(): Promise<ExitCode> {
  let zeroOrFirstErrorCode: U | Nr;

  // Command line arguments and the test runners?
  //
  // It seems the Wdio test runner child processes we launch here inherit our
  // command line incl arguments, and same working dir — in local-runner, there's
  // fork() with: { cwd: process.cwd(), env: runnerEnv, execArgv: this.execArgv },
  // see: ../node_modules/@wdio/local-runner/build/worker.js

  async function withSpecsMatching(testTypes: St[] | St[][], run: (specs: St[]) =>
          Promise<ExitCode>) {

    if (_.isString(testTypes[0])) {
      testTypes = [testTypes as St[]];
    }
    dieIf(!testTypes?.[0]?.length, 'TyE38590RTK');
    let specsNow = [];
    for (let tts of testTypes) {
      let moreSpecs = allMatchingSpecs;
      for (let tt of tts) {
        // Dupl filter (987RM29565W)
        moreSpecs = moreSpecs.filter((fileName: St) => {
          // '!' and '0' (like, Nothing, Not) means exclude those tests.
          const shallInclude = tt[0] !== '0' && tt[0] !== '!';
          const pattern = shallInclude ? tt : tt.substr(1, 999);  // drop any '!'
          const matchesType = fileName.indexOf(pattern) >= 0;
          return matchesType === shallInclude;
        });
      }
      specsNow = [...specsNow, ...moreSpecs];
    }
    const num = specsNow.length;
    if (num >= 1) {
      const sep = '\n - ';
      const what = `'${testTypes.join(' ')}'`;
      logMessage(`Running ${num} specs matching ${what}:` + sep + specsNow.join(sep));

      const exitCode = await run(specsNow);

      if (!zeroOrFirstErrorCode) {
        zeroOrFirstErrorCode = exitCode;
      }
      logErrorIf(exitCode !== 0, `ERROR exit code ${exitCode} from:  ${what}`);
      logMessageIf(exitCode === 0, `Done, fine, exit code 0 from:  ${what}`);
    }
  }


  // Run all variants (e.g. 1br, 2br, 3br) — so we'll find all failing tests
  // without having to restart over and over again:


  // Things that didn't work:
  //
  // 1) Use wdio programaticallly:
  //     const args = { specs }
  //     const wdio = new Launcher('./tests/e2e/wdio.conf.js', args);
  //     return wdio.run();
  // But that's not flexible enough — the way wdio merges `args` into the
  // config obj from wdio.conf.js seems makes it impossible to configure
  // [number of browsers] from here, for example,
  // see: `merge(object = {}) {...}`
  // in: node_modules/@wdio/config/build/lib/ConfigParser.js
  //
  // 2) Spawn wdio directly, and pipe directly to wdio:
  //
  //     const childProcess = spawnInBackground(
  //           'node_modules/.bin/wdio', ['tests/e2e/wdio.conf.js', '--parallel', '3']);
  //     childProcess.stdin.write(specs.join('\n') + '\n');
  //     childProcess.stdin.end();
  //     const promise = new Promise<ExitCode>(function(resolve, reject) {
  //       childProcess.once('exit', function(exitCode: ExitCode) {
  //         resolve(exitCode);
  //       });
  //     })
  //     const exitCode = await promise;
  //     return exitCode;
  //
  // Won't work, because wdio starts before we pipe to it — so wdio looks only
  // at the config file, starts the wrong tests, ignores the stdin pipe input,
  // and exits. But maybe there's a Wdio flag to wait for stdin?
  // I don't see anything in the docs:  https://webdriver.io/docs/clioptions.html
  // (About Nodejs and pipes, see: https://stackoverflow.com/a/52649324)
  //
  // Does work:
  // 3) By using sh -c  we can pipe to stdio directly when it starts,
  // like this 'sh -c ... | ...', look:
  //
  //    bash$ sh -c 'echo "aaa\nbb\ncc\n\ndd\n" | cat'
  //    aaa
  //    bb
  //    cc
  //    
  //    dd


  function pipeSpecsToWdio(specs: St[], wdioArgs: St): St {
    // Need to escape the backslask, like this:  `sh -c "...\\n..."`,
    // so that  sh   gets "...\n..." instead of a real line break.
    const specsOnePerLine = specs.join('\\n');
    return `echo "${specsOnePerLine}" ` +
              `| node_modules/.bin/wdio  tests/e2e/wdio.conf.js  --retry 3  ${wdioArgs}`;
  }


  // TODO   Don't run magic time tests in parallel — they mess up the
  // time for each other.

  const serverAndDirByPort: { [portNr: string]: [ChildProcess, St] } = {};

  function startStaticFileServer(portNr: Nr, relDir: St) {
    const anyOld = serverAndDirByPort[portNr];
    if (anyOld) {
      const oldDir = anyOld[1];
      if (oldDir === relDir) {
        // Already started.
        return;
      }
      const oldServer: ChildProcess = anyOld[0];
      oldServer.kill();
    }
    const cp = spawnInBackground(`node_modules/.bin/http-server -p${portNr} ${relDir}`);
    serverAndDirByPort[portNr] = [cp, relDir];
  }

  function stopStaticFileServer(portNr: Nr) {
    const anyOld = serverAndDirByPort[portNr];
    if (anyOld) {
      const oldServer: ChildProcess = anyOld[0];
      oldServer.kill();
    }
  }


  const skipAlways = ['!UNIMPL', '!-impl.', '!imp-exp-imp-exp-site'];
  const skipEmbAndAlways = ['!emb-com', '!embcom', '!embedded-', ...skipAlways]
  const skip2And3Browsers = ['!.2br', '!.3br'];

  let next: St[] | St[][] = [...skip2And3Browsers, ...skipEmbAndAlways];

  await withSpecsMatching(next, async (specs: St[]): Promise<ExitCode> => {
    //const pipeSpecsToWdio__old =
    //        `echo "${ specs.join('\\n') }" ` +
    //          `| node_modules/.bin/wdio  tests/e2e/wdio.conf.js  --parallel 3`;
    const exitCode = await spawnInForeground('sh', ['-c',
            pipeSpecsToWdio(specs, '')]);  //  '--parallel 3')]);
    return exitCode;
  });


  next = ['.2br', ...skipEmbAndAlways];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    const exitCode = await spawnInForeground('sh', ['-c',
            pipeSpecsToWdio(specs, '--2browsers')]);
    return exitCode;
  });


  next = ['.3br', ...skipEmbAndAlways];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    const exitCode = await spawnInForeground('sh', ['-c',
            pipeSpecsToWdio(specs, '--3browsers')]);
    return exitCode;
  });


  const skipUnusualEmb = ['!no-cookies', '!gatsby', '!embedded-forum',
          ...skip2And3Browsers, ...skipAlways];
  // Accidentally different file names.
  next = [['embedded-', ...skipUnusualEmb],
          ['embcom.', ...skipUnusualEmb],
          ['emb-com.', ...skipUnusualEmb]];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    // Note: 8080 eighty eighty.
    startStaticFileServer(8080, 'target/');
    const exitCode = await spawnInForeground('sh', ['-c',
            pipeSpecsToWdio(specs,
              // Doesn't work, why not? Disable via xx. (BADSTCSRV)
              // The server starts, lisens to 8080, but never replies to anything :-|
              // Just times out.
              '-xx-static-server-8080 -xx-verbose')]);
    return exitCode;
  });


  next = [['embedded-', 'no-cookies', '!gatsby', '!embedded-forum',
          ...skip2And3Browsers, ...skipAlways]];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    startStaticFileServer(8080, 'target/');
    const exitCode = await spawnInForeground('sh', ['-c',
            pipeSpecsToWdio(specs, ' --b3c ' +
              // Doesn't work (BADSTCSRV)
              '-xx-static-server-8080')]);
    return exitCode;
  });


  next = ['.2br', 'embedded-', 'no-cookies', '!gatsby', '!embedded-forum',
          ...skipAlways];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    startStaticFileServer(8080, 'target/');
    const exitCode = await spawnInForeground('sh', ['-c',
            pipeSpecsToWdio(specs, ' --2browsers ' +
              // Doesn't work (BADSTCSRV)
              '-xx-static-server-8080')]);
    return exitCode;
  });

    // Note: 8080 eighty eighty.
  stopStaticFileServer(8080);

  next = ['embedded-', 'gatsby', ...skip2And3Browsers, ...skipAlways];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    // Note: 8000 eighty zero zero.
    startStaticFileServer(8000, 'modules/gatsby-starter-blog/public/');
    const exitCode = await spawnInForeground('sh', ['-c',
            pipeSpecsToWdio(specs,
              // Doesn't work (BADSTCSRV)
              '-xx-static-server-gatsby-v1-8000')]);
    return exitCode;
  });

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    startStaticFileServer(8000, 'modules/gatsby-starter-blog-ed-comments-0.4.4/public/');
    const exitCode = await spawnInForeground('sh', ['-c',
            pipeSpecsToWdio(specs,
              // Doesn't work (BADSTCSRV)
              '-xx-static-server-gatsby-v1-old-ty-8000')]);
    return exitCode;
  });

    // Note: 8000 eighty zero zero.
  stopStaticFileServer(8000);

  return zeroOrFirstErrorCode;
}



console.log(`Running e2e tests ...`);

runE2eTests().then((code) => {
  const fineOrFailed = code === 0 ? 'fine' : 'tests FAILED';
  console.log(`Done running e2e tests, exit code: ${code}, ${fineOrFailed}`);
  logErrorIf(code === undefined, `Error: Didn't run any tests at all [TyE0SPECSRUN]`);
  process.exit(code);
}, (error) => {
  console.error(`Error starting tests [TyEE2ESTART]`, error);  // error.stacktrace ?
  process.exit(1);
});


}
else if (!mainCmdIsOk) {
  console.error(`Werid main command: ${mainCmd}. Error. Bye.  [TyE30598256]`);
  process.exit(1);
}