This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app). See the corresponding documentation to see how you can interact with it apart from what is written in the following README.

## Requirements

Have Node.js and npm installed and working

## Setup

### development

1. Install the dependencies with `npm install`
2. Create and fill an `.env` file in the root of the project (see [reference below](#.env-file-fields) for the keys)
3. Start development version of the website with `npm run start`

### production

1. Install the dependencies with `npm ci` (install exact dependencies as defined by `package-lock.json` file)
2. Create and fill an `.env` file in the root of the project (see [reference below](#.env-file-fields) for the keys)
3. Build the website bundle with `npm run build`

### `.env` file fields

⚠️ No sensible default value is provided for any of these fields, they **need to be defined** ⚠️

| key                 | value                         | description                       |
| ------------------- | ----------------------------- | --------------------------------- |
| NODE_ENV            | `development` or `production` | dev or prod flag                  |
| REACT_APP_REST_ROOT | `<url>`                       | url of the API REST root endpoint |

That is also where you can put Create React App advanced configuration, see
[here](https://create-react-app.dev/docs/advanced-configuration).
