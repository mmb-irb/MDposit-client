import { useEffect, useState } from 'react';
import edgeFractions from 'src/utils/image-edge-fractions';

// Logos with more than this fraction of dark (or light) pixels in contact with the transparent background are not visible
// over a dark (or light) page
const FRACTION_THRESHOLD = 0.4;
// Size of the canvas where the logo is analysed. It is small on purpose, so the analysis is very fast
const ANALYSIS_SIZE = 64;

// Possible results of the analysis
export const DARK_LOGO = 'dark'; // Dark letters, invisible in dark mode, which need a light backdrop there
export const LIGHT_LOGO = 'light'; // Light letters, invisible in light mode, which need a dark backdrop there

// Result of every analysed logo, so it is not analysed again when the logo is shown in another page
const cache = new Map();

// Tell which backdrop the logo needs to be seen in both modes: DARK_LOGO, LIGHT_LOGO or null (none)
// The result does not depend on the theme: the backdrop is applied by the CSS only in the mode where it is needed
// The logo is loaded again here with CORS enabled, since otherwise the canvas could not be read
// The displayed image is not modified, so logos from hosts without CORS keep being displayed
// Logos which can not be loaded with CORS can not be analysed. They are taken as DARK_LOGO, since the light backdrop is
// visible with any logo
// Until the analysis is done there is no backdrop
const useLogoBackdrop = src => {
  const [kind, setKind] = useState(cache.get(src) ?? null);

  useEffect(() => {
    if (!src) return;
    if (cache.has(src)) {
      setKind(cache.get(src));
      return;
    }
    let cancelled = false;
    const finish = value => {
      cache.set(src, value);
      if (!cancelled) setKind(value);
    };
    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.onerror = () => finish(DARK_LOGO);
    probe.onload = () => {
      const scale = ANALYSIS_SIZE / Math.max(probe.naturalWidth, probe.naturalHeight);
      const width = Math.max(1, Math.round(probe.naturalWidth * scale));
      const height = Math.max(1, Math.round(probe.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(probe, 0, 0, width, height);
      const fractions = edgeFractions(context.getImageData(0, 0, width, height));
      if (fractions === null) return finish(null);
      if (fractions.dark > FRACTION_THRESHOLD) return finish(DARK_LOGO);
      if (fractions.light > FRACTION_THRESHOLD) return finish(LIGHT_LOGO);
      finish(null);
    };
    probe.src = src;
    return () => { cancelled = true; };
  }, [src]);

  return kind;
};

export default useLogoBackdrop;
