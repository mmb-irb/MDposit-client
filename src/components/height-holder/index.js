import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import cn from 'classnames';

import style from './style.module.css';

// How long the content is waited for at most
// This is just a safety net for content which never makes it, so the height is not held forever
const MAX_WAIT_TIME = 5000; // ms

// Lets whatever is rendered inside tell the closest height holder that it is loading
// There may be no holder around, in which case there is nothing to tell
const HeightHolderCtx = createContext(null);

// Hold the height of the closest height holder while this component stays rendered
// This is meant for loading indicators: they are rendered in place of the content they replace,
// so their whole life is the time the content is missing
export const useHoldsHeight = () => {
  const holder = useContext(HeightHolderCtx);
  useLayoutEffect(() => {
    if (!holder) return;
    holder.contentLoading();
    return holder.contentLoaded;
  }, [holder]);
};

// Set the logic keeping the height of the given element, whose state lives in this closure
const setHeightHold = holderRef => {
  // How many loading indicators are rendered inside right now
  let loadingCount = 0;
  // The last height measured while the height was not being held
  let contentHeight = 0;
  let maxTimeout = null;
  // Give the held height back, so the new content places the footer again
  const settle = () => {
    const holder = holderRef.current;
    clearTimeout(maxTimeout);
    if (!holder) return;
    holder.style.minHeight = '';
    contentHeight = holder.offsetHeight;
  };
  return {
    contentLoading: () => {
      loadingCount += 1;
      const holder = holderRef.current;
      // Only the first loading indicator holds the height, and there is nothing to hold on the
      // very first render, since there was no content yet
      if (loadingCount > 1 || !holder || !contentHeight) return;
      // Hold the last measured height right away, before the missing content is painted
      holder.style.minHeight = `${Math.min(contentHeight, window.innerHeight)}px`;
      maxTimeout = setTimeout(settle, MAX_WAIT_TIME);
    },
    contentLoaded: () => {
      loadingCount -= 1;
      if (loadingCount) return;
      // Settling is delayed to the end of the current commit on purpose: a loading indicator being
      // replaced by another one (e.g. the one from a lazy page by the one from its data) unmounts
      // before the new one mounts, and settling in between would give the height back just to hold
      // it again right away
      Promise.resolve().then(() => {
        if (!loadingCount) settle();
      });
    },
    // Keep track of how tall the content is, which is the height to hold when it goes missing
    // Anything measured while the height is held is not the content height
    measure: () => {
      const holder = holderRef.current;
      if (holder && !holder.style.minHeight) contentHeight = holder.offsetHeight;
    },
    stop: () => clearTimeout(maxTimeout),
  };
};

// Keeps the height of its content while the content is being reloaded
// Pages are replaced by loading indicators which are way shorter than what they replace, and the
// body is a 100vh flex column (see src/layout/body), so the footer immediately climbs up to the
// bottom of the viewport, becomes visible, and then goes back below the fold as soon as the new
// content is rendered, which reads as a blink.
// To avoid it, the height the content used to take is held while it is missing, so the footer keeps
// its place, the scroll position is not clamped and the content does not jump around either.
// The held height is capped to a viewport since that is all it takes to keep the footer away, and
// holding the whole previous height would leave a huge gap when the new content is a short one.
// The content being missing is not guessed from its height but told by the loading indicators
// themselves (see the hook above), so the height is held before the collapsed content is ever
// painted and given back the very moment the content is there
const HeightHolder = ({ children, className }) => {
  const holderRef = useRef(null);
  const context = useMemo(() => setHeightHold(holderRef), []);
  useEffect(() => {
    const holder = holderRef.current;
    // ResizeObserver is missing in some test environments
    if (!holder || typeof ResizeObserver === 'undefined') return;
    context.measure();
    const observer = new ResizeObserver(context.measure);
    observer.observe(holder);
    return () => {
      observer.disconnect();
      context.stop();
    };
  }, [context]);
  return (
    <HeightHolderCtx.Provider value={context}>
      <div ref={holderRef} className={cn(style.holder, className)}>
        {children}
      </div>
    </HeightHolderCtx.Provider>
  );
};

export default HeightHolder;
