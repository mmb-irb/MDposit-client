import { schedule } from 'timing-functions';
import name from '../../../package.json';

const KEY = `${name}-`;

const MAX_WAIT_TIME = 1000;

export const get = (key, defaultValue) => {
  const storedValue = localStorage.getItem(KEY + key);
  if (storedValue === null) return defaultValue;
  return JSON.parse(storedValue);
};

export const set = (key, value) => {
  localStorage.setItem(KEY + key, JSON.stringify(value));
};

export const setAsync = async (key, value) => {
  await schedule(MAX_WAIT_TIME);
  return set(key, value);
};

export const deleteAll = () => {
  Object.keys(localStorage)
    .filter(key => key.startsWith(KEY))
    .forEach(key => localStorage.removeItem(key));
};
