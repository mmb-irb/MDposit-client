import React, { useState } from 'react';
import { Link } from 'react-router';
import { Button, Collapse } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faEye } from '@fortawesome/free-solid-svg-icons';
import { PBC_CONTACTS_TAG } from '../../../../utils/pbc-contacts';

// Show one warning with its message
// If it has a description then add a button to expand it below the message
// If it has a link then add a button to see it
const Warning = ({ warning, link }) => {
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
        {link && (
          <Button
            component={Link}
            to={link.to}
            size="small"
            variant="outlined"
            sx={{ textTransform: 'none', minWidth: 0, padding: '0 0.4em' }}
          >
            <FontAwesomeIcon icon={faEye} style={{ marginRight: '0.4em' }} />
            {link.label}
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
// If the URL to see PBC contacts is passed then link it from the PBC contacts warning
// There should never be more than one warning with the same tag but, if so, link only the first one
const Warnings = ({ warnings, pbcContactsUrl }) => {
  if (!warnings || warnings.length === 0) return null;
  const pbcContactsWarning = warnings.find(warning => warning.tag === PBC_CONTACTS_TAG);
  return warnings.map((warning, w) => (
    <Warning
      key={w}
      warning={warning}
      link={pbcContactsUrl && warning === pbcContactsWarning
        ? { to: pbcContactsUrl, label: 'See contacts' }
        : null}
    />
  ));
};

export default Warnings;
