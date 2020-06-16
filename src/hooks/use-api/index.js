import { useState, useEffect } from 'react';
import axios from 'axios';

// Get data from the API
// The API will be queried only if the 'condition' is true
// This is a wrokaround to call the API conditionally, since hooks can not be called conditionally
const useAPI = (url, condition = true) => {
  // Set the 'data' state object, which is returned at the end of this function
  const [data, setData] = useState({});

  // This react hook is responisble for sending the request to the API
  // This react hook has 'url' dependencies, so it is only runned once per request
  useEffect(() => {
    // If the condition is false
    if (condition === false) {
      setData({
        url: url,
        loading: null,
        payload: null,
        error: null,
      });
      return;
    }
    // This is axios (https://www.npmjs.com/package/axios)
    // Set a cancel option (token). If a request includes this cancel token in its options, the request can be cancelled
    // In order to cancel the request, the same token must be used through axios
    const source = axios.CancelToken.source();
    let didCancel = false;
    // Make a request in a Promise/await way
    axios(url, {
      cancelToken: source.token,
    })
      // (.then is async) If the request has succeed
      .then(response => {
        if (didCancel) return;
        setData({
          url: url,
          loading: false,
          payload: response.data,
          error: null,
        });
      })
      // Otherwise
      .catch(error => {
        if (didCancel) return;
        setData({
          url: url,
          loading: false,
          payload: null,
          error: error,
        });
      });

    return () => {
      // Cancel the request
      source.cancel();
      didCancel = true;
    };

    // 'useEffect' will only be called when the url change
  }, [url, condition]);
  // Data is returned this way
  // Data is returned only if the data.url matches the url from this request
  // These urls do not macth each first time 'useAPI' is called
  // 'data' is not reset each time 'useAPI' is called so the url is fro, the previous request
  if (data.url === url) return data;
  // The first time 'useAPI' is called only { loading: true } is returned
  else return { loading: true };
};

export default useAPI;
