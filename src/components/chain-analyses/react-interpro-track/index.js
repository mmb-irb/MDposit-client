import React, { memo, useRef, useEffect } from 'react';

import loadCustomElement from '../../../utils/load-custom-element';

// DANI: Esto lo hice mirando el código del antiguo ProperttySetter, pero no llegué a comprenderlo del todo
// https://github.com/aurel-l/react-property-setter/blob/master/src/index.ts

// The result of this function is memoized since it is a heavy work
const InterproTrack = memo(({ match, length, displaystart, displayend, shape, classAttr }) => {

    // Set a reference to the protvista element
    const protvistaRef = useRef();

    // Update element data after render
    useEffect(() => {
        const update = async () => {
            await loadCustomElement(() => import(
                /* webpackChunkName: "protvista-interpro-track" */ 'protvista-interpro-track'
            )).as('protvista-interpro-track');
            protvistaRef.current.data = [match];
            protvistaRef.current.contributors = match.signatures || [];
        }
        update();
    }, []);

    //console.log(match.accession);

    // Render the element
    return (
        <protvista-interpro-track
            ref={protvistaRef}
            length={length}
            displaystart={displaystart}
            displayend={displayend}
            shape={shape}
            class={classAttr}
        />
    );
});

export default InterproTrack;
