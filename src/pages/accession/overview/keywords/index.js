import React from 'react';
import { Chip } from '@mui/material';
import { formatOptionLabel } from 'src/utils/auxiliar-functions';
import style from '../style.module.css';

// Get the system keywords as a list of strings
// SYSKEYS is a list of strings in every node so far, but it may also be missing, or a single string
const parseKeywords = keywords => {
  const list = Array.isArray(keywords) ? keywords : [keywords];
  const valid = list.filter(keyword => typeof keyword === 'string' && keyword.trim());
  return [...new Set(valid)];
};

// Show the system keywords as plain (not clickable) chips
const SystemKeywords = ({ keywords }) => {
  const parsedKeywords = parseKeywords(keywords);
  if (parsedKeywords.length === 0) return null;
  return (
    <div className={style.keywords}>
      {parsedKeywords.map(keyword => (
        <Chip
          key={keyword}
          label={formatOptionLabel(keyword)}
          size="small"
          variant="outlined"
          className={style.chip}
        />
      ))}
    </div>
  );
};

export default SystemKeywords;
