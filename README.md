This project is built with [Vite](https://vite.dev/) and tested with [Vitest](https://vitest.dev/).

## Requirements

Have Node.js 26.12.1 or later and npm installed and working (`engine-strict` in `.npmrc` makes `npm install` fail on older versions)

## Setup

### development

1. Install the dependencies with `npm install`
2. Create and fill an `.env` file in the root of the project (see [reference below](#host-configuration-file) for the keys)
3. Start development version of the website with `npm run start` (http://localhost:3000)
4. Run the tests with `npm test` (watch mode; `npm test -- --run` runs them once)

### production

1. Install the dependencies with `npm ci` (install exact dependencies as defined by `package-lock.json` file)
2. Create and fill an `.env` file in the root of the project (see [reference below](#host-configuration-file) for the keys)
3. Build the website bundle with `npm run build`

### Host configuration file

Target API and some basic visual setup is defined in the [host configuration file](https://mmb.irbbarcelona.org/gitlab/d.beltran.anadon/mdposit_client/-/blob/master/src/utils/constants/default-host-config.js).<br/>
You can define your own custom configuration by creating a new file called host-config.js at the repository root.<br/>
Use the default values as template.<br/>
Note that the client behaviour depends on the host URL.<br/>
This allows a single cliente to service several hosts with a different behaviour for each.<br/>
Comments inside the configuration file will guide you.

## Development

### Make a new version

1. Update the version in `package.json`, `package-lock.json`, commit the changes and create a tag with:
```bash
npm version X.Y.Z
```
2. Push the changes and the tag to the repository:
```bash
git push
git push origin vX.Y.Z
```