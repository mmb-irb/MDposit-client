// This function expects to receive a specific frame or the number of frames to load
// This function returns a string which specifies the frames to be loaded
// This string is standarized in a API friendly format
const getFrames = (
  isProjection,
  totalTrajectoryFrames,
  nFrames,
  noTrajectory,
  requestedFrame,
  //repFrames,
) => {
  // If this is a PCA projection load 20 frames
  // They are meant to have just 20 frames, so if we return an empty string it should work also
  if (isProjection)
    return Array.from({ length: 20 }, (_, i) => i + 1).join(',');
  // If the representations include 'frame' values
  // DANI: Esta parte del código está limita. Con que haya 1 valor de 'frame' se hará esto
  // DANI: En un futuro habría que enseñarle a combinar estas frames con las de la trayectoria completa
  //if (repFrames)
  //  return repFrames.join(',');
  if (!totalTrajectoryFrames)
    throw new Error('Missing number of frames in the requested trajectory');
  // only one specific frame loaded, as a projection
  if (noTrajectory) {
    return (requestedFrame + 1).toString();
  }
  // multiple frames loaded, as a trajectory
  else {
    const frameStep = Math.floor(totalTrajectoryFrames / nFrames);
    return `${1}:${totalTrajectoryFrames}:${frameStep}`;
  }
};

export default getFrames;
