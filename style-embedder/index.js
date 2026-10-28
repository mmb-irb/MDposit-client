const { readFile, writeFile } = require('fs');
const { promisify } = require('util');
const { posix } = require('path');

const asyncReadFile = promisify(readFile);
const asyncWriteFile = promisify(writeFile);

const styleLinkRE = /<link[^>]+\.css[^>]+>/gim;
const hrefRE = /href="\.(?<href>[^"]+)"/i;
const relativeURLInCSS = /url\((['"]?)(\.\.?\/[^)'"]+)/g; // matches: url(../ and url(./

/**
 * This logic is aimed at improving render by injection blocking style inside
 * the index.html document, instead of having to do additional network requests
 */
const main = async () => {
  // read index.html file content
  let indexFile = await asyncReadFile('./build/index.html', {
    encoding: 'utf8',
  });
  // loop over all the style links in the index.html file
  for (const link of indexFile.match(styleLinkRE) || []) {
    // extract href of the stylesheet
    const { href } = (link.match(hrefRE) || []).groups || {};
    // read stylesheet file content
    let style = await asyncReadFile(`./build/${href}`, { encoding: 'utf8' });
    // fix relative urls since they won't be relative to CSS files anymore
    // (CRA writes "url(../../static/media/x)", Vite writes "url(../media/x)": resolve both against the CSS file)
    const cssDir = posix.dirname(href);
    style = style.replace(relativeURLInCSS, (_, quote, url) =>
      `url(${quote}.${posix.join(cssDir, url)}`,
    );
    // but then, we have to add the path to the sourcemaps
    style = style.replace(
      /sourceMappingURL=/g,
      'sourceMappingURL=./static/css/',
    );
    // inline content of stylesheet inside html content
    indexFile = indexFile.replace(
      link,
      `<style data-original-file="${href}">${style}</style>`,
    );
  }
  // output resulting index.html file (by overwriting it)
  await asyncWriteFile('./build/index.html', indexFile, { encoding: 'utf8' });

  // return a message of what we just did
  return '⚡ Injected embeddable stylesheets inside "build/index.html" file ⚡';
};

main().then(console.log, console.error);
