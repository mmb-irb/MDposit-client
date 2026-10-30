// Convert the Nightingale highlight of a chain (e.g. "10:10,25:40") into an NGL selection
// The highlight may have several ranges when non contiguous regions are selected
// Start and end values are in model numeration
const highlightToNgl = (topologyManager, chain, highlight) => highlight
  .split(',')
  .map(range => {
    const [start, end] = range.split(':');
    const sourceStart = topologyManager.getResidueByParameters(chain, +start);
    const sourceEnd = topologyManager.getResidueByParameters(chain, +end);
    if (sourceStart.chainName !== sourceEnd.chainName)
      throw new Error(`Range from multiple chains is not supported`);
    return `:${sourceStart.chainName} and ${sourceStart.number}-${sourceEnd.number}`;
  })
  .join(' or ');

export default highlightToNgl;
