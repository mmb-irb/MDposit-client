// This function expects to receive a specific frame or the number of frames to load
// This function returns a string which specifies the frames to be loaded
// This string is standarized in a API friendly format
const getFrames = (trajectoryFrames, requestedFrames, requestedFrame) => {
  // only one specific frame loaded, as a projection
  if (requestedFrame) {
    return { range: (requestedFrame + 1).toString(), frames: 1 };
  }
  // multiple frames loaded, as a trajectory
  else {
    if (!trajectoryFrames)
      throw new Error('Missing number of frames in the trajectory');
    if (!requestedFrames) throw new Error('Missing number of requested frames');
    const frameStep = Math.floor(trajectoryFrames / requestedFrames);
    // Predict how many frames will be returned, which may be different from the requested frames number
    const returnedFrames = Math.ceil(trajectoryFrames / frameStep);
    return {
      range: `${1}:${trajectoryFrames}:${frameStep}`,
      frames: returnedFrames,
    };
  }
};

export default getFrames;
