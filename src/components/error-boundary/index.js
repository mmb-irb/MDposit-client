import React, { Component } from 'react';

// This is like the JavaScript catch{} block but for React components
class ErrorBoundary extends Component {
  state = { hasError: false };

  componentDidCatch(error, errorInfo) {
    this.setState({ hasError: true });
    // Prints error data in console
    console.error(error);
    console.error(errorInfo);
  }

  render() {
    // In case of error, return an error message to the user
    if (this.state.hasError) {
      return (
        <h1>
          An error happened. Try to reload the page. If the error persists
          please{' '}
          <a href="http://mmb.irbbarcelona.org/www/locationmap">
            get in touch and report it
          </a>
        </h1>
      );
    }
    // If there is no error then return all childrens
    return this.props.children;
  }
}

export default ErrorBoundary;
