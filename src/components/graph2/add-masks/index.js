import { uniqueId } from 'lodash-es';

const addMasks = defs => {
  const idStart = uniqueId('gradient-start-');
  const idEnd = uniqueId('gradient-end-');
  const startMaskGradient = defs.append('linearGradient').attr('id', idStart);
  startMaskGradient
    .append('stop')
    .attr('offset', '0%')
    .style('stop-color', 'white')
    .style('stop-opacity', '1');
  startMaskGradient
    .append('stop')
    .attr('offset', '100%')
    .style('stop-color', 'white')
    .style('stop-opacity', '0');
  const endMaskGradient = defs.append('linearGradient').attr('id', idEnd);
  endMaskGradient
    .append('stop')
    .attr('offset', '0%')
    .style('stop-color', 'white')
    .style('stop-opacity', '0');
  endMaskGradient
    .append('stop')
    .attr('offset', '100%')
    .style('stop-color', 'white')
    .style('stop-opacity', '1');
  return [`url(#${idStart})`, `url(#${idEnd})`];
};

export default addMasks;
