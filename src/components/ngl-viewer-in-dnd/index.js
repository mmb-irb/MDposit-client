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
const NGLViewerSpawner = inputs => {
  // Redefine props since the input object is not modificable
  const props = { ...inputs };

  // Multiple ngl viewers may be spawned
  // Previous 'props' are stored in this array so we can keep rendering those viewers
  // Props include all inputs and 'key' id
  const nailed = useRef([]);

  // Keep listed all arrays which have been used (i.e. ngl viewers which have been nailed or closed)
  const usedIds = useRef([]);
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
  props.id = getNewId();

  // This function adds the current props to the nailed list when value = true. Add 1 to the nailed count
  // This function removes the current props from the nailed list when value = false
  props.nail = value => {
    if (value) {
      nailed.current.push(props);
      usedIds.current.push(props.id);
    } else {
      nailed.current.splice(nailed.current.indexOf(props.id), 1);
    }
  };

  // This function removes props from this viewer from the nailed list if it is nailed
  // This function adds the current id to the used ids list
  // (this way, if the current last window is closed we open a new one instead of reusing it)
  props.setClosed = () => {
    nailed.current.splice(nailed.current.indexOf(props.id), 0);
    usedIds.current.push(props.id);
  };

  // Join the current props with all the nailed props
  // It is important that the current props are the last in the array
  // This way, the current props will be displayed in the new created ngl view, not in the nailed ngl view
  const allProps = [...nailed.current, props];
  // Render a viewer for each prop. Use the 'selected' parameter as unique id
  return allProps.map(ps => <NGLViewerInDND key={ps.id} {...ps} />);
};

// This component render a small NGL viewer
// It is called when user clicks in a point in the projections component
// Also it is called by the generic analysis page
const NGLViewerInDND = props => {
  const {
    // The following arguments are only available when the component is called from...
    analysis, // Generic analysis page
    selected, // Generic analysis page
    requestedFrame, // PCA projections
    setClosed, // Both
  } = props;

  const nglViewRef = useRef(null);

  // Set if the window is rendered or not. It is false when the user clicks on the cross icon
  const [active, setActive] = useState(true);

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
    return {
      width: 'auto', // Let the Rnd logic set the width automatically
      height: 1.5 * dimension, // Reasonable height
      x: 0, // Left border
      y: innerHeight - offsetHeight - 1.5 * dimension - MARGIN + scrollY, // Bottom border
    };
  });
  // Render the component if it is enabled
  if (!active) return null;
  else
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
        bounds="main"
        cancel="canvas, [data-popover]"
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
          if (!nglViewRef.current) return;
          nglViewRef.current.autoResize();
          nglViewRef.current.autoResize.flush();
        }}
      >
        <Card className={style['floating-card']} elevation={4}>
          <Suspense fallback={null}>
            <NGLViewerWithControls
              selected={selected}
              ref={nglViewRef}
              className={style['ngl-viewer-with-controls']}
              startsPlaying={false}
              requestedFrame={
                Number.isFinite(requestedFrame)
                  ? requestedFrame
                  : !analysis || (analysis !== 'fluctuation' && selected)
              }
              close={() => {
                // Remove it from the nailed list if its nailed and add its id to the used ids list
                setClosed();
                // Disable the render of this component
                setActive(false);
              }}
              {...props}
            />
          </Suspense>
        </Card>
      </Rnd>
    );
};

export default NGLViewerSpawner;
