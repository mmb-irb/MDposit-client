import React from 'react';
import { createRoot } from 'react-dom/client';
// The client main script
import App from './App';

import * as serviceWorker from './serviceWorker';

import './index.css';
import 'typeface-roboto';

// Check if "IntersectionObserver" is defined. If not, import a polyfill
// A polyfill is a library which allows using a feature when the navigator does not
const loadPolyfills = async () => {
  if (typeof window.IntersectionObserver === 'undefined') {
    await import(
      // The intersection observer tracks when some elemnt is in the screen or not
      /* webpackChunkName: "intersection-observer" */ 'intersection-observer'
    );
  }
};

const main = async () => {
  // Load an "IntersectionObserver" polyfill if needed
  await loadPolyfills();
  // Loads the "App", which is the main script
  const container = document.getElementById('root');
  const root = createRoot(container);
  root.render(<App />);
};

main();

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.register({});
