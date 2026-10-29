const { createHash } = require('crypto');
const { readdir, readFile, writeFile } = require('fs/promises');

const templateReplace = (input, templateName, replacementString) =>
  input.replace(new RegExp(`["']{{${templateName}}}["']`), replacementString);

const build = async () => {
  // Only the app shell (index.html and the main bundle) is precached, the other chunks are cached at runtime
  // the first time they are used (see the "chunks" route in the template)
  const [indexHTML, jsFiles, template] = await Promise.all([
    readFile('./build/index.html'),
    readdir('./build/static/js'),
    readFile('./sw-build/template.js', { encoding: 'utf8' }),
  ]);
  const mainFiles = jsFiles.filter(file => /^main\..*\.js$/.test(file));
  if (mainFiles.length !== 1)
    throw new Error(
      `Expected one main bundle in build/static/js, found ${mainFiles.length}`,
    );
  const precacheList = [
    // The revision lets the service worker know when index.html changed
    {
      url: 'index.html',
      revision: createHash('md5').update(indexHTML).digest('hex'),
    },
    // File names with a content hash need no revision, so the precache can reuse the copy the page
    // already downloaded instead of fetching it again with a "__WB_REVISION__" parameter
    { url: `static/js/${mainFiles[0]}` },
  ];

  // process and modify template
  const serviceWorker =
    '/* This file is auto-generated, please do not edit it manually */\n\n' +
    templateReplace(
      template,
      'precache',
      JSON.stringify(precacheList, null, 2),
    );

  await writeFile('./build/sw.js', serviceWorker, { encoding: 'utf8' });

  // return a message of what we just did
  return '⚡ Generated a full service worker ⚡';
};

build().then(console.log, error => {
  console.error(error);
  process.exitCode = 1;
});
