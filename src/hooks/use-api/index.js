import { useState, useEffect } from 'react';
import axios from 'axios';

// Empty response
const blank = {
  loading: false,
  payload: null,
  error: null,
};

// Loading response
const loading = {
  loading: true,
};


// Default cache expiration time (e.g., 1 hour in milliseconds)
const DEFAULT_CACHE_EXPIRATION = 60 * 60 * 1000;

// Load cache from localStorage
const loadCache = () => {
  const cachedData = localStorage.getItem('apiCache');
  return cachedData ? JSON.parse(cachedData) : {};
};

// Save cache to localStorage
const saveCache = (cache) => {
  localStorage.setItem('apiCache', JSON.stringify(cache));
};

// Cache object to store API responses
let cache = loadCache();

// Store all calls to the API and their state setter
// This allows to update all states with a unique actual call
const apiCalls = {};

// Get data from the API
const useAPI = (url, cacheOptions = {}) => {
  // Destructure options and set default values
  const {
    name = '',
    cacheOn = false,
    cacheExpiration = DEFAULT_CACHE_EXPIRATION, // Default cache expiration
  } = cacheOptions;
  
  // Check cache synchronously before initializing state
  const initialData = (() => {
    if (cacheOn && cache[name]) {
      const responseData = cache[name];
      const now = Date.now();
      const receivedTime = new Date(responseData.received).getTime()
      // Use cached data if it hasn't expired
      if (now - receivedTime < cacheExpiration) {
        return responseData;
      }
    }
    return blank;
  })();
  // Set the 'data' state object, which is returned at the end of this function
  const [data, setData] = useState(initialData);

  // This react hook is responisble for sending the request to the API
  // This react hook has 'url' dependencies, so it is only runned once per request
  useEffect(() => {
    // In case there is no valid url
    // This may be useful as a workaround to not call the API, since hooks can not be called conditionally
    if (!url) {
      setData(blank);
      return;
    }
    // Check if the current URL has been already requested
    const previousCall = apiCalls[url];
    if (previousCall) {
      // If there is a state already then use it
      // This means the request was already made and answered
      if (previousCall.state) setData(previousCall.state);
      // Otherwise add the setter
      // This means the request was already made but not yet answered
      previousCall.setters.add(setData);
      return;
    }
    // If this is the first call then add it to the api calls
    const originalCall = { setters: new Set([ setData ]) };
    apiCalls[url] = originalCall;
    // This is axios (https://www.npmjs.com/package/axios)
    // Set a cancel option (token). If a request includes this cancel token in its options, the request can be cancelled
    // In order to cancel the request, the same token must be used through axios
    const source = axios.CancelToken.source();
    let didCancel = false;
    // Make a request in a Promise/await way
    axios(url, {
      // This token allows us to further cancel the request if necessary
      cancelToken: source.token,
      // Send the start time so we can calculate the response time when we get the response
      startTime: new Date()
    })
      // (.then is async) If the request has succeed
      .then(response => {
        if (didCancel) return;
        // Calculate the response time
        const endTime = new Date();
        const startTime = response.config.startTime;
        const responseTime = endTime - startTime; // In ms
        // Return response data
        const responseData = {
          url: url,
          loading: false,
          payload: response.data,
          error: null,
          time: responseTime,
          received: endTime,
        };
        // Cache the response if caching is enabled
        if (cacheOn) {
          cache[name] = responseData;
          saveCache(cache);
        }
        // Save the state to be used for future calls
        originalCall.state = responseData;
        // Update all setters wawiting for the response
        originalCall.setters.forEach(setter => setter(responseData));
        //setData(responseData);
      })
      // Otherwise
      .catch(error => {
        if (didCancel) return;
        // Extend the error message with the API error reason
        let errorMessage = error.toString();
        if (error.response && error.response.data)
          errorMessage += ` -> ${error.response.data}`;
        error.message = errorMessage;
        const responseData = {
          url: url,
          loading: false,
          payload: null,
          error: error,
        };
        // Save the state to be used for future calls
        originalCall.state = responseData;
        // Update all setters wawiting for the response
        originalCall.setters.forEach(setter => setter(responseData));
        //setData(responseData);
      });

    return () => {
      // Cancel the request
      source.cancel();
      didCancel = true;
    };

    // 'useEffect' will only be called when the url changes
  }, [url]);
  // If there is no url then return the blank response
  if (!url) return blank;
  // Data is returned this way
  // Data is returned only if the data.url matches the url from this request
  // These urls do not macth each first time 'useAPI' is called
  // 'data' is not reset each time 'useAPI' is called so the url is from the previous request
  if (data.url === url || initialData.url === url) return data;
  // The first time 'useAPI' is called only { loading: true } is returned
  else return loading;
};

export default useAPI;
