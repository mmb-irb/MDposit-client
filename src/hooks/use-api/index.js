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

// Get data from the API
const useAPI = url => {
  // Set the 'data' state object, which is returned at the end of this function
  const [data, setData] = useState(blank);

  // This react hook is responisble for sending the request to the API
  // This react hook has 'url' dependencies, so it is only runned once per request
  useEffect(() => {
    // In case there is no valid url
    // This may be useful as a workaround to not call the API, since hooks can not be called conditionally
    if (!url) {
      setData(blank);
      return;
    }
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
          time: responseTime
        };
        setData(responseData);
      })
      // Otherwise
      .catch(error => {
        if (didCancel) return;
        const responseData = {
          url: url,
          loading: false,
          payload: null,
          error: error,
        };
        setData(responseData);
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
  // 'data' is not reset each time 'useAPI' is called so the url is fro, the previous request
  if (data.url === url) return data;
  // The first time 'useAPI' is called only { loading: true } is returned
  else return loading;
};

export default useAPI;
