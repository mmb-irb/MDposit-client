import colorFromString from '../../../utils/color-from-string';
import mergeIntervals from '../../../utils/merge-intervals';

// Renumerate residue numbers to make them match the actual chain they come from
const shiftLocations = (fragments, shift) => {
  fragments.forEach(fragment => {
    fragment.start += shift;
    fragment.end += shift;
  })
  return fragments;
}

const processLocations = (locations, firstResidueNumber = 1) =>
  locations.map(location => ({
    fragments: shiftLocations(location['location-fragments'], firstResidueNumber),
  }));

const processIPScanResults = (matches, firstResidueNumber) => {
  const processed = [];
  // for all the matches
  for (const match of matches || []) {
    // if the match has an entry, consider it as a signature of the entry
    if (match.signature.entry) {
      let existing = processed.find(
        m => m.accession === match.signature.entry.accession,
      );
      // if the entry hadn't been stored yet, create it now
      if (!existing) {
        existing = {
          accession: match.signature.entry.accession,
          db: 'InterPro',
          signatures: [],
          locations: [],
          color: colorFromString(match.signature.entry.accession),
        };
        processed.push(existing);
      }
      const locations = processLocations(match.locations, firstResidueNumber);
      existing.locations = mergeIntervals(
        [...existing.locations, ...locations],
        (interval, value) =>
          Number.isFinite(value)
            ? (interval.fragments[0].start = value)
            : interval.fragments[0].start,
        (interval, value) =>
          Number.isFinite(value)
            ? (interval.fragments[0].end = value)
            : interval.fragments[0].end,
      );
      // add the match as a signature of that entry
      existing.signatures.push({
        accession: match.signature.accession,
        db: match.signature.signatureLibraryRelease.library,
        locations,
        color: existing.color.replace(', 1)', ', 0.25)'),
      });
    } else {
      // the match doesn't have entry, it is not integrated
      processed.push({
        accession: match.signature.accession,
        db: match.signature.signatureLibraryRelease.library,
        locations: processLocations(match.locations, firstResidueNumber),
        color: colorFromString(match['model-ac']),
      });
    }
  }

  // sort them
  processed
    // secondary sort by start position
    .sort((a, b) => a.locations[0].fragments[0].start - b.locations[0].fragments[0].start)
    // primary sort by number of signatures
    .sort((a, b) => (b.signatures || []).length - (a.signatures || []).length);

  return processed;
};

export default processIPScanResults;
