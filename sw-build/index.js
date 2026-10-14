const { readFile, writeFile } = require('fs');
const { promisify } = require('util');

const workboxBuild = require('workbox-build');

const asyncReadFile = promisify(readFile);
const asyncWriteFile = promisify(writeFile);

const templateReplace = (input, templateName, replacementString) =>
  input.replace(new RegExp(`["']{{${templateName}}}["']`), replacementString);

const build = async () => {
  // async tasks
  // get files to preload
  // Only the app shell (index.html and the main bundle) is precached, the other chunks are cached at runtime
  // the first time they are used (see the "chunks" route in the template)
  const precacheListP = workboxBuild
    .getManifest({
      globDirectory: 'build',
      globPatterns: ['index.html', 'static/js/main.*.js'],
      // File names with a content hash need no revision, so the precache can reuse the copy the page
      // already downloaded instead of fetching it again with a "__WB_REVISION__" parameter
      dontCacheBustURLsMatching: /\.[0-9a-f]{8}\./,
    })
    .then(({ warnings, manifestEntries }) => {
      warnings.forEach(console.warn);
      return manifestEntries;
    });
  // get template service worker
  const templateP = asyncReadFile('./sw-build/template.js', {
    encoding: 'utf8',
  });

  // await for all the previous async tasks (which are just promises for now)
  let [precacheList, template] = await Promise.all([precacheListP, templateP]);

  // process and modify template
  template =
    '/* This file is auto-generated, please do not edit it manually */\n\n' +
    template;
  // replace placeholders
  template = templateReplace(
    template,
    'imports',
    `importScripts('${workboxBuild.getModuleURL('workbox-sw')}')`,
  );
  template = templateReplace(
    template,
    'precache',
    JSON.stringify(precacheList, null, 2),
  );

  // write to output file
  await asyncWriteFile('./build/sw.js', template, { encoding: 'utf8' });

  // return a message of what we just did
  return '⚡ Generated a full service worker ⚡';
};

build().then(console.log, console.error);
