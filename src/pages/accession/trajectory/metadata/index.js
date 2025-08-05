import React, { useContext } from 'react';
// Project metadata saved in this context by the accession component
import { ProjectCtx } from '../../../../contexts';
// Visual components
import { TextField, InputAdornment, } from '@mui/material';
// Import a function to round to cents
import { round2cents } from 'src/utils/auxiliar-functions';
// CSS style
import style from './style.module.css';

// Label to be shown when a metadata field is not available
const NA = 'Not available';

// Helper component for rendering metadata text fields
const MetadataTextField = ({ label, title, value, unit, transform }) => {
    const displayValue =
        value === null || value === undefined
            ? NA
            : transform
            ? transform(value)
            : value;

    const inputProps = unit
        ? {
            endAdornment: (
                <InputAdornment variant="filled" position="end">
                    {unit}
                </InputAdornment>
            ),
        }
        : undefined;

    return (
        <TextField
            className={style['text-field']}
            label={label}
            title={title}
            value={displayValue}
            disabled={value === null || value === undefined}
            InputProps={inputProps}
        />
    );
};

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
            <MetadataTextField
                label="System atoms"
                title="Total number of atoms in the system"
                value={metadata.SYSTATS}
            />
            <MetadataTextField
                label="Proteins atoms"
                title="Number of protein atoms in the system"
                value={metadata.PROTATS}
            />
            <MetadataTextField
                label="Proteins residues"
                title="Number of protein residues in the system"
                value={metadata.PROT}
            />
            <MetadataTextField
                label="Solvent molecules"
                title="Number of solvent molecules in the system"
                value={metadata.SOL}
            />
            <MetadataTextField
                label="Positive ions"
                title="Number of positively charged ions in the system"
                value={metadata.NA}
            />
            <MetadataTextField
                label="Negative ions"
                title="Number of negatively charged ions in the system"
                value={metadata.CL}
            />
        </fieldset>
        <fieldset>
            <legend>System box</legend>
            <MetadataTextField
                label="Type"
                title="Box type"
                value={metadata.BOXTYPE}
            />
            <MetadataTextField
                label="Size X"
                title="Simulated system box X dimension"
                value={metadata.BOXSIZEX}
                transform={round2cents}
                unit="nm"
            />
            <MetadataTextField
                label="Size Y"
                title="Simulated system box Y dimension"
                value={metadata.BOXSIZEY}
                transform={round2cents}
                unit="nm"
            />
            <MetadataTextField
                label="Size Z"
                title="Simulated system box Z dimension"
                value={metadata.BOXSIZEZ}
                transform={round2cents}
                unit="nm"
            />
            <MetadataTextField
                label="Volume"
                title="Simulated system box volume"
                value={
                    metadata.BOXSIZEX === null ||
                        metadata.BOXSIZEY === null ||
                        metadata.BOXSIZEZ === null
                        ? null
                        : metadata.BOXSIZEX * metadata.BOXSIZEY * metadata.BOXSIZEZ
                }
                transform={round2cents}
                unit="nm³"
            />
        </fieldset>
        <fieldset>
            <legend>Simulation</legend>
            <MetadataTextField
                label="Length"
                title="Simulation length"
                value={metadata.timeLength}
                transform={round2cents}
                unit="ns"
            />
            <MetadataTextField
                label="Timestep"
                title="Simulation timestep"
                value={metadata.TIMESTEP}
                unit="fs"
            />
            <MetadataTextField
                label="Snapshots"
                title="Number of snapshots"
                value={metadata.mdFrames}
            />
            <MetadataTextField
                label="Frequency"
                title="Frequency of snapshots"
                value={frequency}
                unit="ps"
            />
            <MetadataTextField
                label="Force fields"
                title="Force fields"
                value={metadata.FF}
                transform={(v) => v.join(', ')}
            />
            <MetadataTextField
                label="Temperature"
                title="Temperature"
                value={metadata.TEMP}
                unit="K"
            />
            <MetadataTextField
                label="Water type"
                title="Water type"
                value={metadata.WAT}
            />
            <MetadataTextField
                label="Ensemble"
                title="Simulation ensemble"
                value={metadata.ENSEMBLE}
            />
            {/*
            <MetadataTextField
                label="Pressure coupling"
                title="Pressure coupling method"
                value={metadata.PCOUPLING}
            />
            <MetadataTextField
                label="Membrane"
                title="Membrane type"
                value={metadata.MEMBRANE}
            /> 
            */}
        </fieldset>
    </>);
};

export default TrajectoryMetadata;