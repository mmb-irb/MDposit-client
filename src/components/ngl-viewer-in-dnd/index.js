import React, { lazy, Suspense, useRef, useState } from 'react';

// Rnd is the resizable and draggable system where the ngl viewer is placed
import { Rnd } from 'react-rnd';

import Card from '../animated-card';

import style from './style.module.css';

const NGLViewerWithControls = lazy(() =>
  import(
    /* webpackChunkName: 'ngl-viewer-with-controls' */ '../ngl-viewer-with-controls'
  ),
);

// Minimal ngl window height
const MIN_NGL_DIMENSION = 150;

// Counter to get always the maximum zIndex
// This is useful to set a new or currently dragged/resized ngl window over the others
let maxZ = 0;
const nextZ = () => {
  maxZ += 1;
  return maxZ;
};

// This function spawns all the NGL viewers needed
// i.e. one viewer with the requested 'props' and all previous viewers which have been nailed
const NGLViewerSpawner = ({ newViewer, nailing = true, onNail, onClose }) => {
  // Store here all nailed NGL viewers
  const [nailedViewers, setNailedViewers] = useState([]);

  // Set the viewers as the nailed viewers and the new viewer
  const viewers = [...nailedViewers];

  // Keep listed all arrays which have been used (i.e. ngl viewers which have been nailed or closed)
  const usedIds = useRef([]);

  if (newViewer) {
    // Find a new suitable Id that meet 2 conditions:
    // - There is never 2 viewers with the same id, so we avoid errors
    // - If we pick diferent frames in the graph without nailing anything, the current viewer has always the same id
    // (This way the current viewer does not appear in the origin position every time)
    const getNewId = () => {
      let id = 0;
      while (id < 999) {
        if (usedIds.current.indexOf(id) === -1) return id;
        id += 1;
      }
      console.error('Maximum number of viewers reached');
    };

    // Set a unique id for this props based in the last nailed viewer
    newViewer.id = getNewId();
    newViewer.close = () => {
      if (nailing) {
        setNailedViewers(nailed => {
          const newNailed = [...nailed];
          const index = nailed.indexOf(newViewer);
          if (index !== -1) newNailed.splice(index, 1);
          return newNailed;
        });
      }
      if (onClose) onClose(newViewer);
      usedIds.current.push(newViewer.id);
    };
    // If the nailer function is passed, add the logic for the viewer to be nailed further
    if (nailing)
      newViewer.nail = () => {
        setNailedViewers(nailed => [...nailed, newViewer]);
        if (onNail) onNail(newViewer);
        usedIds.current.push(newViewer.id);
      };
    // Add the current viewer to the viewers list
    viewers.push(newViewer);
  }

  // Render a viewer for each prop. Use the 'selected' parameter as unique id
  return viewers.map(viewer => <NGLViewerInDND key={viewer.id} {...viewer} />);
};

// This component render a small NGL viewer
// It is called when user clicks in a point in the projections component
// Also it is called by the generic analysis page
const NGLViewerInDND = props => {
  const nglViewRef = useRef(null);

  // Set the default position and size
  const [place, setPlace] = useState(() => {
    // Set an extra margin
    const MARGIN = 20;
    // Get the screen pixel sizes and vertical scroll position
    const { innerWidth, innerHeight, scrollY } = window;
    // The spawned elements are parented to the 'main' element, not to the 'body'
    // We have to take this in count, since the header adds an extra offset in vertical position
    const offsetHeight = document.querySelector('main').offsetTop;
    // Set a reasonable dimension for the ngl window
    const dimension = Math.max(
      Math.min(innerWidth / 4, innerHeight / 4),
      MIN_NGL_DIMENSION,
    );
    const reasonableSize = 1.5 * dimension;
    return {
      // WARNING: If you set the width as 'auto' the window stays very wide when exiting fullscreen
      width: reasonableSize, // Let the Rnd logic set the width automatically
      height: reasonableSize, // Reasonable height
      x: 0, // Left border
      y: innerHeight - offsetHeight - reasonableSize - MARGIN + scrollY, // Bottom border
    };
  });

  return (
    // Rnd is the draggable and resizable system where the ngl viewer is placed
    <Rnd
      position={{ x: place.x, y: place.y }}
      size={{ width: place.width, height: place.height }}
      // Update the zIndex to make this window the first visible
      style={{ zIndex: nextZ() }}
      className={style.rnd}
      data-rnd
      // Limits where the window can be dragged/resized to
      // WARNING: This is problematic since the window may appear out of bounds
      // WARNING: Then when it is moved for the first time it jumps inside the bonds, not elegant
      // bounds="main"
      // Prevent the mouse to drag/resize the window when it is over specific elements
      cancel="canvas, [data-popover], #preventDragSize"
      // On drag/resize starts we do not change anything, but use the hook to re-render this component
      // This way, the zIndex is updated and the selected window becomes the first in the z axis
      // WARNING: Drag functions are also called when you just click (e.g. clicking buttons)
      onDragStart={() => {
        setPlace({ ...place });
      }}
      onResizeStart={() => {
        setPlace({ ...place });
      }}
      onDragStop={(e, d) => {
        // Use this to reject some bugged event calls: e.g. the frames number selector
        if (e.layerX === 0 && e.layerY === 0) return;
        // We re-render only if the new position does not equal the old position
        if (place.x !== d.x || place.y !== d.y)
          setPlace({
            ...place,
            x: d.x,
            y: d.y,
          });
      }}
      // Re-adapt the viewer and update the position/size when the window is resized
      onResize={() => nglViewRef.current && nglViewRef.current.autoResize()}
      onResizeStop={(e, direction, ref, delta, position) => {
        setPlace({
          width: ref.style.width,
          height: ref.style.height,
          ...position,
        });
        // if (!nglViewRef.current) return;
        // nglViewRef.current.autoResize();
        // nglViewRef.current.autoResize.flush();
      }}
    >
      <Card className={style['floating-card']} elevation={4}>
        <Suspense fallback={null}>
          <NGLViewerWithControls
            className={style['floating-card']}
            ref={nglViewRef}
            startsPlaying={false}
            {...props}
          />
        </Suspense>
      </Card>
    </Rnd>
  );
};

export default NGLViewerSpawner;
