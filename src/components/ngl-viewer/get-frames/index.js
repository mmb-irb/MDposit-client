// This function expects to receive a specific frame or the number of frames to load
// This function returns a string which specifies the frames to be loaded
// This string is standarized in a API friendly format
const getFrames = (trajectoryFrames, requestedFrames, requestedFrame) => {
  // only one specific frame loaded, as a projection
  if (requestedFrame) {
    return (requestedFrame + 1).toString();
  }
  // multiple frames loaded, as a trajectory
  else {
    if (!trajectoryFrames)
      throw new Error('Missing number of frames in the trajectory');
    if (!requestedFrames) throw new Error('Missing number of requested frames');
    const frameStep = Math.floor(trajectoryFrames / requestedFrames);
    return `${1}:${trajectoryFrames}:${frameStep}`;
  }
};

export default getFrames;
