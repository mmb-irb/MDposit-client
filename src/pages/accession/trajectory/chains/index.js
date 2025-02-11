import React, {
    memo,
    useContext,
    useEffect,
} from 'react';

// Visual components
import { Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleRight } from '@fortawesome/free-solid-svg-icons';

// Recover the metadata saved in this context by the accession script
import { ProjectCtx } from '../../../../contexts';

// The single chain analysis component, using protvista
import ChainAnalysis from './chain-analysis';

// Check if reduced motion is requested
import reducedMotion from '../../../../utils/reduced-motion';

// CSS style
import style from './style.module.css';

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

const ChainsAnalysis = memo(() => {
    // Load chains references and the topology manager
    const { topology: topologyManager } = useContext(ProjectCtx);
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
                const href = IP_DB &&
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
    // Here chainReferences contains the "analysis" data
    // WARNING: Use the topology manager chain references, not the project manager references
    // WARNING: Otherwise, chain references mya no contain the "chains" field in the first render
    const chainReferences = topologyManager.chainReferences;
    if (chainReferences && chainReferences.length > 0) {
        return (
        <>
            {/* Brief introduction */}
            <Typography variant="h5">Protein functional analysis</Typography>
            <br />
            <Typography variant="subtitle2">
            <strong>{chainReferences.length}</strong> chains were analysed.
            </Typography>
            <ul className={style['chain-analysis-list']}>
            {/* Here, main data is displayed */}
            {(() => {
                // Build all components in a list so we can sort them by chain at the end
                const chainComponents = [];
                chainReferences.forEach(chainReference => {
                    const chainLetters = chainReference.chains;
                    chainLetters.forEach(chainLetter => {
                        // Get some data using the topology manager when it is available
                        let name = '';
                        let firstResidueNumber = 1;
                        if (topologyManager) {
                            const chain = topologyManager.getChainByName(chainLetter);
                            name = chain.metadataChainName;
                            firstResidueNumber = chain.residueNumbers[0];
                        }
                        chainComponents.push(
                            <li key={chainLetter}>
                                <Typography variant="h6">
                                <FontAwesomeIcon icon={faAngleRight} />
                                {` Chain ${chainLetter} ${name ? '(' + name + ')' : ''}`}
                                </Typography>
                                {/* the main visual asset */}
                                <ChainAnalysis
                                    chain={chainLetter}
                                    data={chainReference}
                                    firstResidueNumber={firstResidueNumber}
                                />
                            </li>
                        );
                    });
                });
                // Sort chains alphabetically
                return chainComponents.sort((a, b) => a.key.localeCompare(b.key));
            })()}
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

export default ChainsAnalysis;