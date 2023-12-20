import React, { Component } from 'react';
import { Link } from 'react-router-dom';

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
