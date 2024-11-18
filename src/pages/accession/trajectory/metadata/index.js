
import React, { useContext } from 'react';

// Project metadata saved in this context by the accession component
import { ProjectCtx } from '../../../../contexts';

// Visual components
import {
    TextField,
    InputAdornment,
} from '@mui/material';

// Import a function to round to cents
import { round2cents } from 'src/utils/auxiliar-functions';

// CSS style
import style from './style.module.css';

// Label to be shown when a metadata field is not available
const NA = 'Not available';

// This component displays the trajectory metadata
const TrajectoryMetadata = () => {
    // Load metadata from the project context
    const { metadata } = useContext(ProjectCtx);
    // When there is no metadata
    if (!metadata) return 'No available metadata';
    // Calculate frequency and multiply it by 1000 since it will be represented in picoseconds
    const frequency = (metadata.FRAMESTEP && metadata.FRAMESTEP * 1000) || null;
    // Render the whole metadata
    return (<>
        <fieldset>
            <legend>Counts</legend>
            <TextField
                className={style['text-field']}
                label="System atoms"
                title="Total number of atoms in the system"
                value={metadata.SYSTATS === null ? NA : metadata.SYSTATS}
                disabled={metadata.SYSTATS === null}
            />
            <TextField
                className={style['text-field']}
                label="Proteins atoms"
                title="Number of protein atoms in the system"
                value={metadata.PROTATS === null ? NA : metadata.PROTATS}
                disabled={metadata.PROTATS === null}
            />
            <TextField
                className={style['text-field']}
                label="Proteins residues"
                title="Number of protein residues in the system"
                value={metadata.PROT === null ? NA : metadata.PROT}
                disabled={metadata.PROT === null}
            />
            <TextField
                className={style['text-field']}
                label="Solvent molecules"
                title="Number of solvent molecules in the system"
                value={metadata.SOL === null ? NA : metadata.SOL}
                disabled={metadata.SOL === null}
            />
            <TextField
                className={style['text-field']}
                label="Positive ions"
                title="Number of positively charged ions in the system"
                value={metadata.NA === null ? NA : metadata.NA}
                disabled={metadata.NA === null}
            />
            <TextField
                className={style['text-field']}
                label="Negative ions"
                title="Number of negatively charged ions in the system"
                value={metadata.CL === null ? NA : metadata.CL}
                disabled={metadata.CL === null}
            />
        </fieldset>
        <fieldset>
            <legend>System box</legend>
            <TextField
                className={style['text-field']}
                label="Type"
                title="Box type"
                value={metadata.BOXTYPE === null ? NA : metadata.BOXTYPE}
                disabled={metadata.BOXTYPE === null}
            />
            <TextField
                className={style['text-field']}
                label="Size X"
                title="Simulated system box X dimension"
                value={
                    metadata.BOXSIZEX === null
                    ? NA
                    : round2cents(metadata.BOXSIZEX)
                }
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
                value={
                    metadata.BOXSIZEY === null
                    ? NA
                    : round2cents(metadata.BOXSIZEY)
                }
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
                value={
                    metadata.BOXSIZEZ === null
                    ? NA
                    : round2cents(metadata.BOXSIZEZ)
                }
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
                    ? NA
                    : round2cents(
                        metadata.BOXSIZEX * metadata.BOXSIZEY * metadata.BOXSIZEZ,
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
            <legend>Simulation</legend>
            <TextField
                className={style['text-field']}
                label="Length"
                title="Simulation length"
                value={metadata.timeLength === null ? NA : round2cents(metadata.timeLength)}
                disabled={metadata.timeLength === null}
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
                value={metadata.TIMESTEP === null ? NA : metadata.TIMESTEP}
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
                value={metadata.mdFrames === null ? NA : metadata.mdFrames}
                disabled={metadata.mdFrames === null}
            />
            <TextField
                className={style['text-field']}
                label="Frequency"
                title="Frequency of snapshots"
                value={
                    frequency === null
                    ? NA
                    : frequency
                }
                disabled={frequency === null}
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
                label="Force fields"
                title="Force fields"
                value={metadata.FF === null ? NA : metadata.FF.join(', ')}
                disabled={metadata.FF === null}
            />
            <TextField
                className={style['text-field']}
                label="Temperature"
                title="Temperature"
                value={metadata.TEMP === null ? NA : metadata.TEMP}
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
                value={metadata.WAT === null ? NA : metadata.WAT}
                disabled={metadata.WAT === null}
            />
            <TextField
                className={style['text-field']}
                label="Ensemble"
                title="Simulation ensemble"
                value={metadata.ENSEMBLE === null ? NA : metadata.ENSEMBLE}
                disabled={metadata.ENSEMBLE === null}
            />
            {/*
            <TextField
                className={style['text-field']}
                label="Pressure coupling"
                title="Pressure coupling method"
                value={metadata.PCOUPLING === null ? NA : metadata.PCOUPLING}
                disabled={metadata.PCOUPLING === null}
            />
            <TextField
                className={style['text-field']}
                label="Membrane"
                title="Membrane type"
                value={metadata.MEMBRANE === null ? NA : metadata.MEMBRANE}
                disabled={metadata.MEMBRANE === null}
            />*/}
        </fieldset>
    </>);
};

export default TrajectoryMetadata;