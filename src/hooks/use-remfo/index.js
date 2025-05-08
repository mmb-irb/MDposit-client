import { useMemo, useRef } from 'react';

// Get a memoized value just like a useMemo would
// However you can access the previous memoized value as the first (and only) function argument
const useRemfo = (func, deps) => {
    const previousValue = useRef();
    const newValue = useMemo(() => func(previousValue.current), deps);
    previousValue.current = newValue;
    return newValue;
};

export default useRemfo;
