import ReactGA from "react-ga4";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

// Get the Google Analytics id
window.process = window.process || require('process');
const googleAnalyticsId = process.env.REACT_APP_GOOGLE_ANALYTICS_ID;

// Initialize GA4 with "Consent Mode v2" defaults
export const initGA = () => {
  // Skip initialization if no GA ID is configured
  if (!googleAnalyticsId  || googleAnalyticsId.includes('DANI')) {
    console.warn("Google Analytics ID not configured");
    return;
  }

  // 1. Define the gtag function if it doesn't exist and expose it globally
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };
  }
  
  // 2. Set default consent to 'denied' immediately
  // This tells Google not to use storage until the user agrees
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });

  // 3. Initialize ReactGA
  ReactGA.initialize(googleAnalyticsId);

  // 4. Check if user already gave consent (returning visitor)
  const existingConsent = getCookieValue("MDpositCookieConsent");
  if (existingConsent === "true") {
    setConsent(true);
  }
};

// Helper to read cookie value
const getCookieValue = (name) => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
};

// Function to update consent state when user accepts
export const setConsent = (granted) => {
  const consentState = granted ? "granted" : "denied";
  
  if (window.gtag) {
    window.gtag("consent", "update", {
      ad_storage: consentState,
      ad_user_data: consentState,
      ad_personalization: consentState,
      analytics_storage: consentState,
    });
  }
};

export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    // Send pageview with a custom path
    ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
  }, [location]);
};
