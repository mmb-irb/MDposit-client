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
const useAPI = (url, cacheOptions = {}, timeout = null) => {
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
    // If the request was already made and answered then use its state
    // There is nothing to wait for, so there is no need to add the setter
    if (previousCall && previousCall.state) {
      setData(previousCall.state);
      return;
    }
    // If the request was already made but not yet answered then wait for it
    // Otherwise this is the first call so we make the request
    const call = previousCall || makeCall(url, timeout, cacheOn, name);
    call.setters.add(setData);
    return () => {
      // Stop waiting for this request
      call.setters.delete(setData);
      // If nobody else is waiting for it then cancel it
      // Also forget it, so the next time this url is requested a new request is made
      if (call.setters.size === 0 && !call.state) {
        call.cancel();
        if (apiCalls[url] === call) delete apiCalls[url];
      }
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

// Send a request to the API and register it in the api calls, so it is shared by all hooks asking for the same url
// Every hook waiting for the response adds its state setter to the call setters
const makeCall = (url, timeout, cacheOn, name) => {
    // This is axios (https://www.npmjs.com/package/axios)
    // Set a cancel option (token). If a request includes this cancel token in its options, the request can be cancelled
    // In order to cancel the request, the same token must be used through axios
    const source = axios.CancelToken.source();
    const originalCall = {
      setters: new Set(),
      cancelled: false,
      cancel: () => {
        originalCall.cancelled = true;
        source.cancel();
      },
    };
    apiCalls[url] = originalCall;
    // Make a request in a Promise/await way
    axios(url, {
      // This token allows us to further cancel the request if necessary
      cancelToken: source.token,
      // Header used by the backend to identify requests coming from this frontend hook.
      headers: { ['X-MDDB-Request-Source']: 'mdposit-client' },
      // Timeout to handle when a node is not responding
      timeout: timeout,
      // Send the start time so we can calculate the response time when we get the response
      startTime: new Date()
    })
      // (.then is async) If the request has succeed
      .then(response => {
        if (originalCall.cancelled) return;
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
        if (originalCall.cancelled) return;
        // Extend the error message with the API error reason
        const errorOriginalMessage = error.message;
        let errorMessage = errorOriginalMessage || error.toString();
        if (error.response && error.response.data)
          errorMessage += ` -> ${error.response.data}`;
        error.message = errorMessage;
        // If the error comes from our own timeout then change the message completely
        if (error.code === 'ECONNABORTED' || errorOriginalMessage === 'Network Error') {
          error.message = 'The node is not responding';
          // Also add a flag used by others
          error.noResponse = true;
        }
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
    return originalCall;
};

export default useAPI;
