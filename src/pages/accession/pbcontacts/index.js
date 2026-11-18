import React, { useContext } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

// Project data context
import { ProjectCtx } from '../../../contexts';

// Visual components
import Card from '../../../components/animated-card';
import { CardContent } from '@mui/material';

// The molecular viewer
import ViewerWithControls from '../../../components/viewer-with-controls';

import { getPbcContactsWarning } from '../../../utils/pbc-contacts';
import usePbcContactsView from './use-pbc-contacts-view';

// CSS style
import style from './style.module.css';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

// The viewer showing the frame with most contacts across periodic boundaries (PBC)
// The system is shown together with the periodic images it contacts and the residues in contact
const PbcContactsViewer = () => {
  const view = usePbcContactsView();
  // Wait for the simulation box
  if (!view) return <div style={{ height: '50vh' }} />;
  return (
    <ViewerWithControls
      className={style.container}
      startingComponents={view.components}
      startingRepresentations={view.representations}
      initialFocus={view.initialFocus}
      // Periodic images are only supported by the NGL viewer
      allowMolstar={false}
    />
  );
};

// Show the contacts across periodic boundaries reported in the warnings
const PbcContacts = () => {
  // Track if the viewer is on screen
  const [viewerRef, isViewerVisible] = useInView(useInViewOptions);

  const { metadata, topology } = useContext(ProjectCtx);
  const warning = getPbcContactsWarning(metadata);
  if (!warning) return (
    <Card className={style.card}>
      <CardContent>
        <div className={style.title}>Contacts across periodic boundaries</div>
        <p>No contacts across periodic boundaries have been registered for this MD.</p>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Card className={style.card}>
        <CardContent>
          <div className={style.title}>Contacts across periodic boundaries</div>
          <p>
            {warning.message}. Showing frame {warning.frame}, which has the most atoms in contact,
            together with the periodic images of the system which it contacts (in light blue).
            Residues in contact are highlighted in orange.
          </p>
        </CardContent>
      </Card>
      <Card className={style['ngl-card']} ref={viewerRef}>
        {/* Render once on screen and the topology is ready (see the trajectory page) */}
        {isViewerVisible && topology ? <PbcContactsViewer /> : <div style={{ height: '50vh' }} />}
      </Card>
    </>
  );
};

export default PbcContacts;
