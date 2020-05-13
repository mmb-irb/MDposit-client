import React, { memo, useContext, useEffect } from 'react';
// A hook to track whenever some element is on screen
import { useInView } from 'react-intersection-observer';
import { round } from 'lodash-es';

import {
  CardContent,
  Typography,
  TextField,
  InputAdornment,
} from '@material-ui/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleRight } from '@fortawesome/free-solid-svg-icons';

// Recover the metadata saved in this context by the accession script
import { ProjectCtx } from '../../../contexts';

import Card from '../../../components/animated-card';
import NGLViewerWithControls from '../../../components/ngl-viewer-with-controls';
import ChainAnalyses from '../../../components/chain-analyses';

import reducedMotion from '../../../utils/reduced-motion';

import style from './style.module.css';

const na = 'Not available';

// This component displays the trajectory metadata and it is also called by other scripts
export const TrajectoryMetadata = memo(() => {
  // Load metadata from the project context
  const { metadata } = useContext(ProjectCtx);
  if (metadata)
    // Render the whole metadata
    return (
      <fieldset>
        <legend>
          <Typography variant="h6">Statistics</Typography>
        </legend>
        <fieldset>
          <legend>Counts</legend>
          <TextField
            className={style['text-field']}
            label="System atoms"
            title="Total number of atoms in the system"
            value={metadata.SYSTATS === null ? na : metadata.SYSTATS}
            disabled={metadata.SYSTATS === null}
          />
          <TextField
            className={style['text-field']}
            label="Proteins atoms"
            title="Number of protein atoms in the system"
            value={metadata.PROTATS === null ? na : metadata.PROTATS}
            disabled={metadata.PROTATS === null}
          />
          <TextField
            className={style['text-field']}
            label="Proteins residues"
            title="Number of protein residues in the system"
            value={metadata.PROT === null ? na : metadata.PROT}
            disabled={metadata.PROT === null}
          />
          <TextField
            className={style['text-field']}
            label="Phospholipids"
            title="Number of membrane molecules in the system"
            value={metadata.DPPC === null ? na : metadata.DPPC}
            disabled={metadata.DPPC === null}
          />
          <TextField
            className={style['text-field']}
            label="Solvent molecules"
            title="Number of solvent molecules in the system"
            value={metadata.SOL === null ? na : metadata.SOL}
            disabled={metadata.SOL === null}
          />
          <TextField
            className={style['text-field']}
            label="Positive ions"
            title="Number of positively charged ions in the system"
            value={metadata.NA === null ? na : metadata.NA}
            disabled={metadata.NA === null}
          />
          <TextField
            className={style['text-field']}
            label="Negative ions"
            title="Number of negatively charged ions in the system"
            value={metadata.CL === null ? na : metadata.CL}
            disabled={metadata.CL === null}
          />
        </fieldset>
        <fieldset>
          <legend>Simulation box</legend>
          <TextField
            className={style['text-field']}
            label="Type"
            title="Box type"
            value={metadata.BOXTYPE === null ? na : metadata.BOXTYPE}
            disabled={metadata.BOXTYPE === null}
          />
          <TextField
            className={style['text-field']}
            label="Size X"
            title="Simulated system box X dimension"
            value={metadata.BOXSIZEX === null ? na : metadata.BOXSIZEX}
            disabled={metadata.BOXSIZEX === null}
            InputProps={{
              endAdornment: (
                <InputAdornment variant="filled" position="end">
                  nm
                </InputAdornment>
              ),
            }}
          />
          <TextField
            className={style['text-field']}
            label="Size Y"
            title="Simulated system box Y dimension"
            value={metadata.BOXSIZEY === null ? na : metadata.BOXSIZEY}
            disabled={metadata.BOXSIZEY === null}
            InputProps={{
              endAdornment: (
                <InputAdornment variant="filled" position="end">
                  nm
                </InputAdornment>
              ),
            }}
          />
          <TextField
            className={style['text-field']}
            label="Size Z"
            title="Simulated system box Z dimension"
            value={metadata.BOXSIZEZ === null ? na : metadata.BOXSIZEZ}
            disabled={metadata.BOXSIZEZ === null}
            InputProps={{
              endAdornment: (
                <InputAdornment variant="filled" position="end">
                  nm
                </InputAdornment>
              ),
            }}
          />
          <TextField
            className={style['text-field']}
            label="Volume"
            title="Simulated system box volume"
            value={
              metadata.BOXSIZEX === null ||
              metadata.BOXSIZEY === null ||
              metadata.BOXSIZEZ === null
                ? na
                : round(
                    +metadata.BOXSIZEX *
                      +metadata.BOXSIZEY *
                      +metadata.BOXSIZEZ,
                    5,
                  )
            }
            disabled={
              !(metadata.BOXSIZEX && metadata.BOXSIZEY && metadata.BOXSIZEZ)
            }
            InputProps={{
              endAdornment: (
                <InputAdornment variant="filled" position="end">
                  nm³
                </InputAdornment>
              ),
            }}
          />
        </fieldset>
        <fieldset>
          <legend>Other</legend>
          <TextField
            className={style['text-field']}
            label="Length"
            title="Simulation length"
            value={metadata.LENGTH === null ? na : metadata.LENGTH}
            disabled={metadata.LENGTH === null}
            InputProps={{
              endAdornment: (
                <InputAdornment variant="filled" position="end">
                  ns
                </InputAdornment>
              ),
            }}
          />
          <TextField
            className={style['text-field']}
            label="Timestep"
            title="Simulation timestep"
            value={metadata.TIMESTEP === null ? na : metadata.TIMESTEP}
            disabled={metadata.TIMESTEP === null}
            InputProps={{
              endAdornment: (
                <InputAdornment variant="filled" position="end">
                  fs
                </InputAdornment>
              ),
            }}
          />
          <TextField
            className={style['text-field']}
            label="Snapshots"
            title="Number of snapshots"
            value={metadata.SNAPSHOTS === null ? na : metadata.SNAPSHOTS}
            disabled={metadata.SNAPSHOTS === null}
          />
          <TextField
            className={style['text-field']}
            label="Frequency"
            title="Frequency of snapshots"
            value={metadata.FREQUENCY === null ? na : metadata.FREQUENCY}
            disabled={metadata.FREQUENCY === null}
            InputProps={{
              endAdornment: (
                <InputAdornment variant="filled" position="end">
                  ps
                </InputAdornment>
              ),
            }}
          />
          <TextField
            className={style['text-field']}
            label="Force field"
            title="Force field"
            value={metadata.FF === null ? na : metadata.FF}
            disabled={metadata.FF === null}
          />
          <TextField
            className={style['text-field']}
            label="Temperature"
            title="Temperature"
            value={metadata.TEMP === null ? na : metadata.TEMP}
            disabled={metadata.TEMP === null}
            InputProps={{
              endAdornment: (
                <InputAdornment variant="filled" position="end">
                  K
                </InputAdornment>
              ),
            }}
          />
          <TextField
            className={style['text-field']}
            label="Water type"
            title="Water type"
            value={metadata.WAT === null ? na : metadata.WAT}
            disabled={metadata.WAT === null}
          />
          <TextField
            className={style['text-field']}
            label="Ensemble"
            title="Simulation ensemble"
            value={metadata.ENSEMBLE === null ? na : metadata.ENSEMBLE}
            disabled={metadata.ENSEMBLE === null}
          />
          <TextField
            className={style['text-field']}
            label="Pressure coupling"
            title="Pressure coupling method"
            value={metadata.PCOUPLING === null ? na : metadata.PCOUPLING}
            disabled={metadata.PCOUPLING === null}
          />
          <TextField
            className={style['text-field']}
            label="Membrane"
            title="Membrane type"
            value={metadata.MEMBRANE === null ? na : metadata.MEMBRANE}
            disabled={metadata.MEMBRANE === null}
          />
        </fieldset>
      </fieldset>
    );
  // When there is no metadata
  else return 'No available metadata';
}); // End of the metadata boxes

const dbMap = new Map([
  ['InterPro', 'InterPro'],
  // special cases
  ['TIGRFAM', 'tigrfams'],
  ['PROSITE_PROFILES', 'profile'],
  ['PROSITE_PATTERNS', 'prosite'],
  ['SUPERFAMILY', 'ssf'],
  ['GENE3D', 'cathgene3d'],
  // just the same, but lowercase
  ['CDD', 'cdd'],
  ['HAMAP', 'hamap'],
  ['PANTHER', 'panther'],
  ['PFAM', 'pfam'],
  ['PIRSF', 'pirsf'],
  ['PRINTS', 'prints'],
  ['SFLD', 'sfld'],
  ['SMART', 'smart'],
]);

const Analyses = memo(() => {
  // Load chains, accession and identifier from the project context
  // 'chains' is undefined if no chains were loaded in this project
  const { chains, accession, identifier } = useContext(ProjectCtx);
  // Portals create a window where a web page is pre rendered without navigating to
  // You can navigate to this web page by clicking on the portal
  // NOTE: see https://web.dev/hands-on-portals for tutorial on Portals
  useEffect(() => {
    // bypass React for DOM alteration
    // document.createElement is a different way to create React elements
    const popup = document.createElement('div');
    popup.className = style.popup;
    let portal, portalContainer;
    if ('HTMLPortalElement' in window) {
      portalContainer = document.createElement('div');
      portalContainer.className = style['portal-container'];
      portal = document.createElement('portal');
      portalContainer.appendChild(portal);
      popup.appendChild(portalContainer);
      portal.addEventListener('click', () => {
        const bcr = portal.getBoundingClientRect();
        portal.animate(
          { transform: [`scale(1) translate(${-bcr.left}px, ${-bcr.top}px)`] },
          {
            duration: reducedMotion() ? 0 : 1000,
            easing: 'cubic-bezier(.23,-0.26,0,1)',
            fill: 'both',
          },
        ).onfinish = () => {
          // TODO: whenever the bug removing history when activating a portal is
          // TODO: fixed, use this piece of code
          // portal.activate();
          // TODO: in the meantime... (yes, it does an ugly flash 🤷‍)
          window.location.href = portal.src;
        };
      });
    }

    const link = document.createElement('a');
    link.rel = 'noopener';
    link.target = '_blank';
    popup.appendChild(link);

    let displayed = false;
    let timeout;

    const clearPopup = () => {
      link.textContent = '';
      link.href = '';
      if (portal) {
        portalContainer.style.display = 'none';
        portal.src = null;
        portal.removeAttribute('src');
      }
      popup.style.visibility = 'hidden';
      popup.style.transform = 'translate(0, 0)';
    };

    const popupEnterHandle = () => clearTimeout(timeout);
    const popupLeaveHandle = () => (timeout = setTimeout(clearPopup, 1000));

    popup.addEventListener('mouseenter', popupEnterHandle);
    popup.addEventListener('mouseleave', popupLeaveHandle);

    // event handler for events emitted by the nightingale/protvista components
    const handler = event => {
      if (!event.detail) return;
      let bcrTarget, bcrPopup, bcrTrack;
      switch (event.detail.eventtype) {
        case 'mouseover':
          if (!event.detail.feature.accession) return;

          clearTimeout(timeout);

          const IP_DB = dbMap.get(event.detail.feature.db);
          const href =
            IP_DB &&
            `https://www.ebi.ac.uk/interpro/entry/${IP_DB}/${event.detail.feature.accession}/`;
          if (portal && IP_DB) portal.src = href;
          link.textContent = `${event.detail.feature.db} - ${event.detail.feature.accession}`;
          link.href = href;
          if (IP_DB) {
            if (portal) portalContainer.style.display = 'block';
          } else {
            if (portal) {
              portalContainer.style.display = 'none';
              portal.removeAttribute('src');
              portal.src = null;
            }
            link.removeAttribute('href');
          }

          bcrTarget = event.detail.target.getBoundingClientRect();
          bcrPopup = popup.getBoundingClientRect();
          bcrTrack = event.detail.target
            .closest('protvista-interpro-track')
            .getBoundingClientRect();

          // x
          const translateX = Math.min(
            Math.max(
              // center the popup in the middle of the region
              bcrTarget.left + bcrTarget.width / 2 - bcrPopup.width / 2,
              // make sure the popup doesn't overflow to the left
              bcrTrack.left,
            ),
            // make sure the popup doesn't overflow to the right
            bcrTrack.right - bcrPopup.width,
          );
          // y
          const translateY = window.scrollY + bcrTarget.top - bcrPopup.height;

          popup.style.visibility = 'visible';
          popup.style.transform = `translate(${translateX}px, ${translateY}px)`;

          displayed = true;
          break;
        case 'mouseout':
          if (!displayed) return; // no need to do DOM operation, it's already invisible
          timeout = setTimeout(clearPopup, 1000);

          displayed = false;
          break;
        default:
        // ignore
      }
    };
    document.body.appendChild(popup);
    window.addEventListener('change', handler);
    // clean-up logic
    return () => {
      window.removeEventListener('change', handler);
      popup.removeEventListener('mouseenter', popupEnterHandle);
      popup.removeEventListener('mouseleave', popupLeaveHandle);
      document.body.removeChild(popup);
    };
  }, []);

  // Render the functional analysis with a brief introduction
  // Here 'chains' is just the chain letters. The main data is downloaded further at the ChainAnalyses component
  if (chains && chains.length > 0) {
    // Order the chains inexes by alphabetic number
    chains.sort();
    return (
      <>
        {/* Brief introduction */}
        <Typography variant="h5">Protein functional analysis</Typography>
        <br />
        <Typography variant="subtitle2">
          <strong>{chains.length}</strong> chains were analysed.
        </Typography>
        <Typography variant="body1">
          Below you can see the families, domains, and sites, that an{' '}
          <a
            href="https://www.ebi.ac.uk/interpro/about/interproscan/"
            target="_blank"
            rel="noreferrer noopener"
          >
            InterProScan
          </a>{' '}
          analysis revealed for each of the chain sequences. This is a
          prediction that might be helpful to discover functions, or to find
          similar structures for example.
        </Typography>
        <br />
        <Typography variant="body1">
          You can interact with this visualisation as such:
          <br />
          <strong>Hover over their representation</strong> to see that some of
          them will have a corresponding page on the{' '}
          <a
            href="https://www.ebi.ac.uk/interpro/"
            target="_blank"
            rel="noreferrer noopener"
          >
            InterPro website
          </a>{' '}
          where you will be able to learn more about it.
          <br />
          <strong>Click on them</strong> to see the corresponding sequence
          highlighted in the interactive trajectory viewer above. Clicking on an
          other entity within the same chain will change the highlight to that
          other entity.
          <br />
          <strong>Click on an empty space</strong> in this visualisation to
          remove the highlight for that chain.
          <br />
          <strong>Scroll over the visualisation</strong> to zoom in or out of
          the chain sequence. Alternatively, you can also interact with the top
          navigation part (at the top of each visualisation) to zoom in and out
          or to move within the sequence.
        </Typography>
        <ul className={style['chain-analysis-list']}>
          {/* Here, main data is displayed */}
          {chains.map(chain => (
            <li key={chain}>
              <Typography variant="h6">
                <FontAwesomeIcon icon={faAngleRight} /> Chain {chain}
              </Typography>
              {/* ChainAnalyses is the main visual asset */}
              <ChainAnalyses
                chain={chain}
                accession={accession || identifier}
              />
            </li>
          ))}
        </ul>
        <Typography variant="body2">
          Data generated using{' '}
          <a
            href="https://www.ebi.ac.uk/"
            target="_blank"
            rel="noreferrer noopener"
          >
            EBI
          </a>
          's{' '}
          <a
            href="https://www.ebi.ac.uk/interpro/about/interproscan/"
            target="_blank"
            rel="noreferrer noopener"
          >
            InterProScan service
          </a>{' '}
          and visualised using the{' '}
          <a
            href="https://ebi-webcomponents.github.io/nightingale/"
            target="_blank"
            rel="noreferrer noopener"
          >
            Nightingale visualisation library
          </a>
          .
        </Typography>
      </>
    );
  } else return 'No chain analyses available';
});

// Define permanent options for the "useInView"
const useInViewOptions = { triggerOnce: true, rootMargin: '100px' };

const Trajectory = () => {
  // useInView acts as a React hook
  // Track if the NGL viewer (nglRef) and the analyses (nightingaleRef) are on screen
  // The status (e.g. isNglVisible) is returned true/false when the element is in/out the screen respectively
  const [nglRef, isNglVisible] = useInView(useInViewOptions);
  const [nightingaleRef, isNightingaleVisible] = useInView(useInViewOptions);

  // Get the current project metadata and chains
  const { metadata, chains } = useContext(ProjectCtx);

  // Set the chains to be represented in the NGL viewer
  const chainsNGL = [];
  for (const chain of chains) {
    chainsNGL.push({
      name: 'Chain ' + chain,
      selection: ':' + chain,
    });
  }
  if (metadata.MEMBRANE !== 'No')
    chainsNGL.push({
      selection: '(not polymer or hetero) and not (water or ion)',
      name: metadata.MEMBRANE,
      defaultDrawingMethod: 'licorice',
      defaultOpacity: 0.5,
    });

  return (
    <>
      <Card className={style.card}>
        <CardContent>
          {/* Renders the whole metadata */}
          <TrajectoryMetadata />
        </CardContent>
      </Card>
      <Card className={style.card} ref={nglRef}>
        {/* Render the NGL viewer when it is on screen*/}
        {isNglVisible ? (
          <NGLViewerWithControls
            className={style.container}
            chains={chainsNGL}
          />
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
      <Card className={style.card} ref={nightingaleRef}>
        {isNightingaleVisible ? (
          <CardContent>
            {/* Render all the previously defined analyses part when it is on screen*/}
            <Analyses />
          </CardContent>
        ) : (
          <div style={{ height: '50vh' }} />
        )}
      </Card>
    </>
  );
};

export default Trajectory;
