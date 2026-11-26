import { timer, easeCubicInOut, easeElastic } from 'd3';

// device pixel ratio (for "retina" screens)
const dPR = window.devicePixelRatio || 1;

// easing for start animation (looks like a spring coming out of the centre)
const customElastic = easeElastic.amplitude(1).period(0.5);

// timer instance variable
let t;

// background: the colour to clean the canvas with. It must be already resolved, since canvas can not read CSS variables
export default ({ context, dataPoints, width, height, maxTime, isFirstTime, background = 'white' }) =>
  new Promise(res => {
    if (t) t.stop();
    t = timer(elapsed => {
      const isLastDraw = elapsed >= maxTime;
      // if we finished transitioning, clear completely the canvas
      if (isLastDraw) {
        t.stop();
        context.fillStyle = background;
        context.fillRect(0, 0, width * dPR, height * dPR);
      } else {
        // clean up the canvas before drawing everything else
        // using the background, but opacity 0.25, to keep a shadow of the previous drawings
        // to give the illusion of movement
        context.fillStyle = background;
        context.globalAlpha = 0.25;
        context.fillRect(0, 0, width * dPR, height * dPR);
        context.globalAlpha = 1;
      }
      // loop on every data point and draw them
      for (const dataPoint of dataPoints) {
        const easedProgress = Math.max(
          0,
          (isFirstTime ? customElastic : easeCubicInOut)(
            Math.min((elapsed - dataPoint.delay) / dataPoint.duration, 1),
          ),
        );
        // x
        dataPoint.currentX = dataPoint.interpolateX(easedProgress);
        // skip out-of-screen points
        if (dataPoint.currentX < 0 || dataPoint.currentX > width) continue;
        dataPoint.currentY = dataPoint.interpolateY(easedProgress);
        // y
        dataPoints.currentRadius = dataPoints.interpolateRadius(easedProgress);
        // skip out-of-screen points
        if (dataPoint.currentY < 0 || dataPoint.currentY > height) continue;
        // draw point
        context.fillStyle = dataPoint.fill.hex;
        context.beginPath();
        context.arc(
          dataPoint.currentX,
          dataPoint.currentY,
          dataPoints.currentRadius,
          0,
          2 * Math.PI,
        );
        context.fill();
      }
      if (isLastDraw) res();
    });
  });
