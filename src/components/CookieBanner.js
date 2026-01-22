import CookieConsent from "react-cookie-consent";
import { useTheme } from '@mui/material/styles';
import { setConsent } from "../utils/analytics";

const CookieBanner = () => {
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const primaryDarkColor = theme.palette.primary.dark;
  const secondaryColor = theme.palette.secondary.contrastText;
  const secondaryDark = theme.palette.secondary.dark;

  return (
    <CookieConsent
      location="bottom"
      buttonText="I Understand"
      declineButtonText="Decline"
      enableDeclineButton
      cookieName="MDpositCookieConsent" // The name of the cookie that remembers the user's choice
      flipButtons
      style={{ background: primaryColor }}
      buttonStyle={{ color: secondaryColor, background: primaryDarkColor, fontSize: "13px", border: `1px solid ${secondaryColor}` }}
      declineButtonStyle={{ fontSize: "13px", background: secondaryDark, border: `1px solid ${secondaryColor}` }}
      expires={150} // Days until the cookie expires
      
      // Triggered when user clicks "I Understand"
      onAccept={() => {
        setConsent(true); // Update Google tags to "granted"
      }}
      
      // Triggered when user clicks "Decline"
      onDecline={() => {
        setConsent(false); // Update Google tags to "denied" (optional, as default is denied)
      }}
    >
      This website uses cookies to enhance the user experience.{" "}
    </CookieConsent>
  );
};

export default CookieBanner;