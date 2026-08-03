import reducedMotion from '../reduced-motion';

// Sections are faded out when the location is about to change (see src/App) and faded back
// in once the new page is rendered (see src/components/animated-card)
// Both halves live here because the fade out animations keep filling once they are done,
// so whatever they leave behind is what the fade in has to start from

// Opacity is always animated on its own, with a linear ramp
// Sharing an animation with the transform would mean sharing its easing too, and the springy
// ones below overshoot, so the section would hold full opacity and then vanish all at once,
// which makes the transition look like a blink
const OPACITY_EASING = 'linear';

// The vertical displacement, in pixels, sections travel while they fade
// This is where the bouncy easings are welcome, and it is dropped under reduced motion
const OFFSET = 50;
const OUT_TRANSFORM_EASING = 'cubic-bezier(.33,-0.65,.56,1.1)';
const IN_TRANSFORM_EASING = 'cubic-bezier(0, .99, .56, 1.1)';

// Keep the fade out short, since the time it takes is time where nothing is visible
export const OUT_DURATION = 300;
const IN_OPACITY_DURATION = 400;
const IN_TRANSFORM_DURATION = 500;

// Sections are cascaded, although by far less than the animations so they overlap
// Delays are capped so pages with many sections do not keep the last ones waiting
const OUT_DELAY = { step: 50, max: 150 };
const IN_DELAY = { step: 80, max: 240 };

// Get the delay for a section given its position among the animated sections
// The index may be -1 for a section out of a page transition (e.g. the embed route,
// which is rendered outside the main element)
const delay = ({ step, max }, index) => Math.min(max, Math.max(0, index) * step);

// Fade a section out and slide it down, on the way out of the current location
// Animations are left filling, so the section stays hidden until the new page fades it in
// Return whether the section could be animated at all
export const fadeSectionOut = (section, index) => {
  if (!section.animate) return false;
  const sectionDelay = delay(OUT_DELAY, index);
  section.animate(
    { opacity: [1, 0] },
    {
      fill: 'both',
      easing: OPACITY_EASING,
      duration: OUT_DURATION,
      delay: sectionDelay,
    },
  );
  if (!reducedMotion())
    section.animate(
      { transform: ['translateY(0)', `translateY(${OFFSET}px)`] },
      {
        fill: 'both',
        easing: OUT_TRANSFORM_EASING,
        duration: OUT_DURATION,
        delay: sectionDelay,
      },
    );
  return true;
};

// Get how long fading out the given number of sections takes
// This is what the router waits before actually changing the location
export const fadeOutTime = count => OUT_DURATION + delay(OUT_DELAY, count - 1);

// Fade a section in and slide it up, once the new location is rendered
// Only the transform is cascaded: delaying the opacity would hold the section invisible
// (these animations fill as well) right after the fade out already hid it
// Return the running animations, so the caller may cancel them
export const fadeSectionIn = (section, index) => {
  const animations = [
    section.animate(
      { opacity: [0, 1] },
      { fill: 'both', easing: OPACITY_EASING, duration: IN_OPACITY_DURATION },
    ),
  ];
  if (!reducedMotion())
    animations.push(
      section.animate(
        { transform: [`translateY(${OFFSET}px)`, 'translateY(0)'] },
        {
          fill: 'both',
          easing: IN_TRANSFORM_EASING,
          duration: IN_TRANSFORM_DURATION,
          delay: delay(IN_DELAY, index),
        },
      ),
    );
  return animations;
};
