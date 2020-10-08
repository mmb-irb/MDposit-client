import { useEffect, useReducer } from 'react';
import { autoLoad } from 'ngl';

// This logic is used by the "useReducer" and executed by a "dispatch", whcih provides a type (action.type)
// This function expects an initial state and an action which will be used to calculate a new state
// In addition, other variables are calculated and sent back
const nglFileReducer = (state, action) => {
  switch (action.type) {
    case 'INIT':
      return { ...state, loading: true, file: null };
    case 'SUCCESS':
      return { ...state, loading: false, file: action.file };
    case 'ERROR':
      return { ...state, loading: false, error: action.error };
    // An error is sent when the state type is not one of the previous 3 options
    default:
      throw new Error(`"${action.type}" is not a valid action`);
  }
};

// Get data from a specific directory in the API
// The difference between this hook and useAPI hook is the use of 'autoLoad' instead of 'axios'
// 'autoLoad' is the built in function from NGL to load data
const useNGLFiles = (url, { defaultRepresentation, ext }) => {
  // useReducer is a react hook
  const [state, dispatch] = useReducer(nglFileReducer, {
    loading: !!url,
    file: null,
    error: null,
  });

  useEffect(() => {
    if (!url) {
      dispatch({ type: 'SUCCESS' });
      return;
    }

    dispatch({ type: 'INIT' });

    let didCancel = false;

    // Load data from the API
    autoLoad(url, { defaultRepresentation, ext })
      .then(file => !didCancel && dispatch({ type: 'SUCCESS', file }))
      .catch(error => !didCancel && dispatch({ type: 'ERROR', error }));

    return () => (didCancel = true);
  }, [url, defaultRepresentation, ext]);

  return state;
};

export default useNGLFiles;
