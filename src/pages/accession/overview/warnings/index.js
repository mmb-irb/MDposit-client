import React, { useState } from 'react';
import { Button, Collapse } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

// Show one warning with its message
// If it has a description then add a button to expand it below the message
const Warning = ({ warning }) => {
  const [expanded, setExpanded] = useState(false);
  const description = warning.description;
  return (
    <div>
      <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4em' }}>
        <FontAwesomeIcon icon={faExclamationTriangle} size={'lg'} />
        <span>{warning.message}</span>
        {description && (
          <Button
            size="small"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            sx={{ textTransform: 'none', minWidth: 0, padding: '0 0.4em' }}
          >
            {expanded ? 'See less' : 'See more'}
          </Button>
        )}
      </div>
      {description && (
        <Collapse in={expanded} unmountOnExit>
          {/* Descriptions may have line breaks and indentation */}
          <div style={{ whiteSpace: 'pre-wrap', marginLeft: '1.8em', marginTop: '0.3em' }}>
            {description}
          </div>
        </Collapse>
      )}
    </div>
  );
};

// Show the list of project warnings
const Warnings = ({ warnings }) => {
  if (!warnings || warnings.length === 0) return null;
  return warnings.map((warning, w) => <Warning key={w} warning={warning} />);
};

export default Warnings;
