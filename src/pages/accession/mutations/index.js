import React, { useContext, Suspense } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';

import Card from '../../../components/animated-card';
/*
import {
  CardContent,
} from '@material-ui/core';
*/
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';
import useMutationsRepresentations from '../../../components/ngl-viewer/use-mutations-representations';

import style from './style.module.css';

import { ProjectCtx } from '../../../contexts';

import Loading from '../../../components/loading';

//import ResidueSelector from '../../../components/residue-selector';

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Mutations = () => {
  // Track if the NGL viewer
  // The status isNglVisible is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);

  // Set when one point in the graph is selected
  //const [selectedResidues, setSelectedResidues] = useState([]);

  // Get the current project metadata
  const { metadata } = useContext(ProjectCtx);

  // Set the representations for the NGL viewer
  const representations = useMutationsRepresentations(metadata);

  return (
    <Suspense fallback={<Loading />}>
      {
        // DANI: Esto habría que implementarlo un día
        // DANI: No es tan facil como copiar el de rmsd-perres, porque aquel usa los residuos del payload
        /*<Card>
        <CardContent className={style.paper}>
          
          <ResidueSelector
            modelResidues={modelResidues}
            selectedResiduesSetter={setSelectedResidues}
          />
          
        </CardContent>
      </Card>*/
      }
      <Card className={style.nglcard} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            representations={representations}
            //selectedResidues={selectedResidues}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </Suspense>
  );
};

export default Mutations;
