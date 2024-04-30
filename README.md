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

### Host configuration file

Target API and some basic visual setup is defined in the [host configuration file](https://mmb.irbbarcelona.org/gitlab/d.beltran.anadon/mdposit_client/-/blob/master/src/utils/constants/host-configs.js).<br/>
Note that the client behaviour depends on the host URL.<br/>
This allows a single cliente to service several hosts with a different behaviour for each.<br/>
Comments inside the configuration file will guide you.