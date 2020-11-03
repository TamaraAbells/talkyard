import * as _  from 'lodash';
import * as minimist from 'minimist';
import Launcher from '@wdio/cli'
import * as glob from 'glob';
import { die, dieIf } from '../tests/e2e/utils/log-and-die';
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
function spawnInBackground(cmd: string, args: string[]): ChildProcess {
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


function spawnInForeground(cmd: string, args: string[]) {
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
console.log(`Running tests?: ${e2eSpecsPattern} ...`);

const files = glob.sync(e2eSpecsPattern, {});

console.log(`Files:\n - ${files.join('\n - ')}`);

const args = {
  ...cmdLineArgs,
  //specs: ['tests/e2e/specs/manual.2browsers.test.ts'],
  specs: files.length ? files : [
    'tests/e2e/specs/all-links.test.ts',
    'tests/e2e/specs/api-list-query-for-posts.test.ts',
    'tests/e2e/specs/api-list-query-for-topics.test.ts',
    'tests/e2e/specs/api-search-full-text.test.ts',
    'tests/e2e/specs/authz-basic-see-reply-create.test.ts',
    'tests/e2e/specs/authz-view-as-stranger.test.ts',
    'tests/e2e/specs/create-site-facebook.test.ts',
    'tests/e2e/specs/create-site-github-oauth-uppercase-email.test.ts',
    'tests/e2e/specs/create-site-gmail-and-email-notf.test.ts',
    'tests/e2e/specs/create-site-linkedin.test.ts',
    'tests/e2e/specs/create-site-password-run-admin-intro-tours.test.ts',
    'tests/e2e/specs/drafts-delete.test.ts',
    'tests/e2e/specs/drafts-new-topic-from-cats-page.test.ts',
    'tests/e2e/specs/emb-com.all-logins.1br.test.ts',
    'tests/e2e/specs/emb-com.all-logins-old-name.1br.test.ts',
    'tests/e2e/specs/embed-images-mp4-youtube.test.ts',
    'tests/e2e/specs/embed-twitter-tweets-etc.test.ts',
    'tests/e2e/specs/impersonate-restricted-areas.test.ts',
    'tests/e2e/specs/link-previews-all-others.test.ts',
    'tests/e2e/specs/login-required-oauth-signup-login.test.ts',
    'tests/e2e/specs/navigation-as-admin.test.ts',
    'tests/e2e/specs/navigation-as-member.test.ts',
    'tests/e2e/specs/navigation-as-stranger.test.ts',
    'tests/e2e/specs/oauth-signup-signin.test.ts',
    'tests/e2e/specs/page-type-discussion-progress.test.ts',
    'tests/e2e/specs/page-type-idea-statuses-comments.test.ts',
    'tests/e2e/specs/page-type-info-page.test.ts',
    'tests/e2e/specs/page-type-problem-statuses.test.ts',
    'tests/e2e/specs/sso-admin-extra-login.test.ts',
    'tests/e2e/specs/upload-images-and-files.test.ts',
    'tests/e2e/specs/user-profile-access.test.ts',
    'tests/e2e/specs/user-profile-cannot-delete-openauth-email.test.ts',
    'tests/e2e/specs/user-profile-change-username.test.ts',
    'tests/e2e/specs/utx-all-logins.test.ts',
    'tests/e2e/specs/votes-and-best-first.test.ts',
  ],
};

//DUPL CODE for now [DUPWDIOCNF]
// Depending on which e2e tests to run, amend `args` so we'll use the
// correct capabilities and static files help server.
// 
// `args` gets merged into the WebdriverIO.Config returned by wdio.conf.ts.
// So, args.specs gest aded to? overrides? the config.spec in wdio.conf.ts.

// Can look at node_modules/@wdio/cli/build/launcher.js  to see
// ex of how handle async errs?
async function runE2eTests(): Promise<number> {

  // Command line arguments and the test runners?
  //
  // It seems the Wdio test runner child processes we launch here inherit our
  // command line incl arguments, and same working dir — in local-runner, there's
  // fork() with: { cwd: process.cwd(), env: runnerEnv, execArgv: this.execArgv },
  // see: ../node_modules/@wdio/local-runner/build/worker.js

  function shallRun(...testTypes: string[]) {
    dieIf(!testTypes?.length, 'TyE38590RTK');
    for (let tt of testTypes) {
      const found = !!files.find((fileName: string) => fileName.indexOf(`.${tt}.`) >= 0);
      if (!found) return false;
    }
    return true;
  }

  const run1BrIdpAuth = shallRun('1br', 'idpauth');
  const runIdpAuth = shallRun('idpauth');

  // ...

  const wdio = new Launcher('./tests/e2e/wdio.conf.js', args);
  const code = await wdio.run();
  return code;
}


console.log(`Running e2e tests ...`);

runE2eTests().then((code) => {
  const fineOrFailed = code === 0 ? 'fine' : 'tests FAILED';
  console.log(`Done running e2e tests, exit code: ${code}, ${fineOrFailed}`);
  process.exit(code);
}, (error) => {
  console.error(`Error starting tests`, error.stacktrace);
  process.exit(1);
});
