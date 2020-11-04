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

type ExitCode = Nr | Nl;


function spawnInBackground(cmdMaybeArgs: St, anyArgs?: St[]): ChildProcess { // , opts: { pipeStdIn?: Bo } = {})
  let cmd = cmdMaybeArgs;
  let args = anyArgs;

  if (_.isUndefined(args)) {
    const cmdAndArgs = cmdMaybeArgs.split(' ').filter(v => !!v.trim());
    cmd = cmdAndArgs[0];
    args = cmdAndArgs.slice(1);
  }

  console.log(`\n\nSpawn bg:  ${cmd} ${args.join(' ')}\n`);
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

  console.log(`\n\nSpawn fg:  ${cmd} ${args.join(' ')}\n`);
  // stdio 'inherit' makes the child process write directly to our stdout,
  // so colored output and CTRL+C works.
  const result = _spawnSync(cmd, args, { stdio: 'inherit' });
  return result.status;
}



// Skip the firts two, argv[1] = /usr/bin/node  argv[2] = <path-to-repo>/s/tyd.
const cmdLineArgs: any = minimist(process.argv.slice(2));
 
const mainCmd = process.argv[2];
const manySubCmds = process.argv.slice(3); // drop the main command
const subCmd = manySubCmds[0];

console.log(`cmdLineArgs: ${JSON.stringify(cmdLineArgs)}`);
console.log(`process.argv: ${JSON.stringify(process.argv)}`);



if (mainCmd === 'justwatch') {
  spawnInForeground('make watch'); // 'InForeground');
  process.exit(0);
}

if (mainCmd === 'watchup') {
  const watchChildProcess = spawnInBackground('make watch');
  // RACE BUG when starting, we'll run  logs -f  too soon,
  // before any containers have started. Seems it then exits and
  // shuts down  watch & the log tailing.
  spawnInBackground('docker-compose up -d');
  spawnInForeground('docker-compose logs -f --tail 0');
  watchChildProcess.kill();
  // But don't shut down the Ty server? That'd be annoying?
  // For that, use s/tyd kill
  process.exit(0);
}

if (mainCmd === 'kill') {
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


if (mainCmd !== 'e2e') {
  console.error(`Werid main command: ${mainCmd}. Error. Bye.  [TyE30598256]`);
  process.exit(1);
}




// -----------------------------------------------------------------------
//  E2E Tests
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

  async function withSpecsMatching(testTypes: St[], run: (specs: St[]) =>
          Promise<ExitCode>) {

    dieIf(!testTypes?.length, 'TyE38590RTK');
    let specsNow = allMatchingSpecs;
    for (let tt of testTypes) {
      // Dupl filter (987RM29565W)
      specsNow = specsNow.filter((fileName: St) => {
        // '!' and '0' (like, Nothing, Not) means exclude those tests.
        // (0 is simpler to type on the command line, need not be escaped).
        const shallInclude = tt[0] !== '0' && tt[0] !== '!';
        const pattern = shallInclude ? tt : tt.substr(1, 999);  // drop any '!'
        const matchesType = fileName.indexOf(pattern) >= 0;
        return matchesType === shallInclude;
      });
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
              `| node_modules/.bin/wdio  tests/e2e/wdio.conf.js  ${wdioArgs}`;
  }

  const skipAlways = ['!UNIMPL', '!-impl.', '!imp-exp-imp-exp-site'];
  const skipEmbAndAlways = ['!emb-', '!embedded-', ...skipAlways]
  const skip2And3Browsers = ['!.2br', '!.3br'];

  let next = [...skip2And3Browsers, ...skipEmbAndAlways];

  // TODO   Don't run magic time tests in parallel — they mess up the
  // time for each other.

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


  next = ['embedded-', '!no-cookies', '!gatsby', '!embedded-forum',
          ...skip2And3Browsers, ...skipAlways];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    const exitCode = await spawnInForeground('sh', ['-c',
            pipeSpecsToWdio(specs, '--static-server-8080 --verbose')]);
    return exitCode;
  });


  next = ['embedded-', 'no-cookies', '!gatsby', '!embedded-forum',
          ...skip2And3Browsers, ...skipAlways];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    const exitCode = await spawnInForeground('sh', ['-c',
            pipeSpecsToWdio(specs, '--static-server-8080 --b3c')]);
    return exitCode;
  });


  next = ['.2br', 'embedded-', 'no-cookies', '!gatsby', '!embedded-forum',
          ...skipAlways];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    const exitCode = await spawnInForeground('sh', ['-c',
            pipeSpecsToWdio(specs, '--static-server-8080 --2browsers')]);
    return exitCode;
  });


  next = ['embedded-', 'gatsby', ...skip2And3Browsers, ...skipAlways];

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    const exitCode = await spawnInForeground('sh', ['-c',
            pipeSpecsToWdio(specs, '--static-server-gatsby-v1-8000')]);
    return exitCode;
  });

  await withSpecsMatching(next, async (specs: St[]): Promise<Nr> => {
    const exitCode = await spawnInForeground('sh', ['-c',
            pipeSpecsToWdio(specs, '--static-server-gatsby-v1-old-ty-8000')]);
    return exitCode;
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
  console.error(`Error starting tests [TyEE2ESTART]`, error);  // error.stacktrace ?
  process.exit(1);
});
