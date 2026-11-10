// Import the default host values
import { getDefaultHostConfig } from "./default-host-config";

// Complete a host configuration with default and derived values
// Note that the host configuration is modified in place and also returned
// This is done always, no matter which host configuration file is used
export default function processHostConfig (hostConfig) {
    // Fill the host configuration gaps with default values
    // If the host configuration does not set the host then use the requesting URL domain
    const host = hostConfig.host || window.location.hostname;
    Object.entries(getDefaultHostConfig(host)).forEach(([ field, defaultValue ]) => {
        if (!hostConfig[field]) hostConfig[field] = defaultValue;
    });
    // If the client is not in "production mode" then allow also the "published" query
    if (!hostConfig.production) hostConfig.queryFields["Other"].push({
        "name": "Published",
        "path": "published",
        "type": "boolean",
        "example": "true",
        "options": true,
        "checkbox": true,
    });
    // Put all the sub options of each field on a plane list
    hostConfig.availableFields = Object.values(hostConfig.queryFields).reduce((acc, curr) => acc.concat(curr), []);
    return hostConfig;
}
