import { useState, useEffect } from 'react';
import axios from 'axios';

// Empty response
const blank = {
  loading: false,
  payload: null,
  error: null,
};
// Get data from the API for multiple URLs
const useBatchAPI = (urls, responseType = 'arraybuffer') => {
  // Set the 'data' state object, which is returned at the end of this function
  const [data, setData] = useState(urls.map(url => ({ url: url, ...blank })));

  // This react hook is responisble for sending the request to the API
  // This react hook has 'url' dependencies, so it is only runned once per request
  useEffect(() => {
    // This is axios (https://www.npmjs.com/package/axios)
    // Set a cancel option (token). If a request includes this cancel token in its options, the request can be cancelled
    // In order to cancel the request, the same token must be used through axios
    const source = axios.CancelToken.source();
    let didCancel = false;
    // Reset data to match in length with the urls
    // Try to reuse old data in case any url matches
    setData(oldData => {
      const newData = urls.map(url => {
        // If the url is not valid then kill it
        // This is a workaround of the useAPI hook, but here it makes not sense
        if (!url) throw new Error('Missing URL in batch API call');
        // Search for this url in old data and return it in case we find it
        const alreadySearchedResponse = oldData.find(response => response.url === url);
        if (alreadySearchedResponse) return alreadySearchedResponse;
        // Otherwise return the loading response
        return { url: url, loading: true };
      })
      return newData;
    });
    // Iterate over each url
    urls.forEach((url, i) => {
      // Make a request in a Promise/await way
      axios(url, {
        // This token allows us to further cancel the request if necessary
        cancelToken: source.token,
        // Send the start time so we can calculate the response time when we get the response
        startTime: new Date(),
        responseType: responseType,
        headers: {
          ['X-MDDB-Request-Source']: 'mdposit-client',
        },
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
          setData(previousData => {
            const newData = [ ...previousData ]
            newData[i] = responseData;
            return newData;
          });
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
          setData(previousData => {
            const newData = [ ...previousData ]
            newData[i] = responseData;
            return newData;
          });
        });
    });

    return () => {
      // Cancel the request
      source.cancel();
      didCancel = true;
    };

    // 'useEffect' will only be called when the url changes
  }, [urls]);
  // If there is no url then return an empty list
  if (!urls) return [];
  // Data is returned here
  return data;
};

export default useBatchAPI;
