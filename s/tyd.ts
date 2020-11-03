import * as _  from 'lodash';
import * as minimist from 'minimist';
import Launcher from '@wdio/cli'

// import logAndDie = require('./log-and-die');

// Nice!: https://github.com/f/omelette
// or?: https://github.com/mattallty/Caporal.js
// (There's also:  https://github.com/mklabs/tabtab but abandoned?)
// Maybe later: https://github.com/denoland/deno

// Test traits:
//  1br, 2br, 3br,  b3c  mgt   idpauth  extreq-goog-fb-lin-githb-gitlb-twtr


const cmdLineArgs: any = minimist(process.argv.slice(2));

const args = {
  ...cmdLineArgs,
  //specs: ['tests/e2e/specs/manual.2browsers.test.ts'],
  specs: [
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

const isWatchMode = false;

const wdio = new Launcher('./tests/e2e/wdio.conf.js', args, isWatchMode);

wdio.run().then((code) => {
  process.exit(code);
}, (error) => {
  console.error(`Launcher from @wdio/cli couldn't start test`, error.stacktrace);
  process.exit(1);
});

