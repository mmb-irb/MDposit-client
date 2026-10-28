import React, { Component } from 'react';
import { Link } from 'react-router';

// Remember when we last reloaded because of a missing chunk, so a chunk which is really missing
// (e.g. a broken deploy or being offline) shows the error instead of reloading in a loop
const CHUNK_RELOAD_KEY = 'chunkErrorReloadTime';
const CHUNK_RELOAD_WINDOW = 10000; // ms
// A failed lazy import() is a plain TypeError, with a different message in each browser
// (Chrome, Firefox and Safari, in this order)
const CHUNK_ERROR_MESSAGE = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/;

// This is like the JavaScript catch{} block but for React components
// Error boundaries do not catch errors inside event handlers
// Pass a 'resetKey' (e.g. the current path) to clear the error when it changes
class ErrorBoundary extends Component {
  state = { hasError: false };

  componentDidCatch(error, errorInfo) {
    // If we are having a then we reload the page
    // This is usally caused by when we update the client code and make a new build
    if (CHUNK_ERROR_MESSAGE.test(error.message)) {
      // Storage may be blocked (e.g. the embed page in a third-party iframe): then reload as usual
      let lastReload = 0;
      try { lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)); } catch {}
      if (!(Date.now() - lastReload < CHUNK_RELOAD_WINDOW)) {
        try { sessionStorage.setItem(CHUNK_RELOAD_KEY, Date.now()); } catch {}
        window.location.reload();
        return;
      }
    }
    // Otherwise do this
    this.setState({ hasError: true });
    // Prints error data in console
    console.error(error);
    console.error(errorInfo);
  }

  componentDidUpdate(prevProps) {
    // Try to render the children again once the user moves somewhere else
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey)
      this.setState({ hasError: false });
  }

  render() {
    // In case of error, return an error message to the user
    if (this.state.hasError) {
      return (
        <h1>
          An error happened. Try to reload the page. If the error persists
          please{' '}
          <Link to="/contact" title="contact page" target="_blank" rel="noopener noreferrer">
            get in touch and report it
          </Link>
        </h1>
      );
    }
    // If there is no error then return all childrens
    return this.props.children;
  }
}

export default ErrorBoundary;
