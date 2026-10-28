// Tell how to go from the built molstar representations to the requested ones, as the NGL viewer does
// Rebuilding every representation on any change is slow in big systems (e.g. an 80k atom membrane)
// Representations are described by a snapshot of the values they were built with, since this app
// changes representations in place (see RepresentationsManager)
// Every representation is identified by its position and name, as in the NGL viewer

// Tell if two molstar color themes are the same (see nglColorToTheme and nglSchemeToTheme)
// Their parameters are a few plain values, e.g. a color number or the id of an NGL scheme
const sameColorTheme = (theme, other) =>
  theme.name === other.name && JSON.stringify(theme.params) === JSON.stringify(other.params);

// Tell if a built representation has the requested color and opacity
const sameLook = (built, requested) =>
  built.opacity === requested.opacity && sameColorTheme(built.colorTheme, requested.colorTheme);

// Tell if a built representation has the requested atoms and drawing method
// Selections which only NGL understands select other atoms once NGL is available, so the NGL structure counts
// NGL distance representations are shapes, which are built again for any change
const sameGeometry = (built, requested) =>
  built.component === requested.component &&
  built.selection === requested.selection &&
  built.type === requested.type &&
  built.other === requested.other &&
  built.nglStructure === requested.nglStructure &&
  (requested.type !== 'distance' || sameLook(built, requested));

// Get the key identifying a representation, as in the NGL viewer
export const getRepresentationKey = (representation, index) => `${index}-${representation.name}`;

// Find which built representations are kept, which of them change their color or opacity only,
// which representations are to be built and which built ones are to be deleted
// Built representations are given by their key, with the snapshot they were built with
// Requested representations are snapshots, and hidden representations are not requested
// Representations of rebuilt components are built again, since they are deleted along with their structure
// Kept representations are given with their requested snapshot, which may have another color or opacity
export const diffRepresentations = (built, requested, rebuiltComponents = new Set()) => {
  const kept = [];
  const toBuild = [];
  for (const snapshot of requested) {
    const previous = built.get(snapshot.key);
    if (!previous || rebuiltComponents.has(snapshot.component) || !sameGeometry(previous.snapshot, snapshot))
      toBuild.push(snapshot);
    else kept.push({ previous, snapshot });
  }
  const toUpdate = kept.filter(({ previous, snapshot }) => !sameLook(previous.snapshot, snapshot));
  const keptKeys = new Set(kept.map(({ snapshot }) => snapshot.key));
  const toDelete = [...built].filter(([key]) => !keptKeys.has(key)).map(([, previous]) => previous);
  return { kept, toUpdate, toBuild, toDelete };
};
