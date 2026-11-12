import React from 'react';
import { Link } from 'react-router';
import { Chip } from '@mui/material';
import { formatOptionLabel } from 'src/utils/auxiliar-functions';
import { buildFilter, stringifyQuery } from 'src/utils/filters';
import { DecoratedListItem } from 'src/components/decorated-list';
import style from '../style.module.css';

// Get the system keywords as a list of strings
// SYSKEYS is a list of strings in every node so far, but it may also be missing, or a single string
const parseKeywords = keywords => {
  const list = Array.isArray(keywords) ? keywords : [keywords];
  const valid = list.filter(keyword => typeof keyword === 'string' && keyword.trim());
  return [...new Set(valid)];
};

// Show the system keywords as chips which browse projects with the same keyword
const SystemKeywords = ({ keywords }) => {
  const parsedKeywords = parseKeywords(keywords);
  if (parsedKeywords.length === 0) return null;
  return (
    <DecoratedListItem title="Keywords">
      {parsedKeywords.map(keyword => {
        // Keep the keyword as stored, since the search matches it exactly
        const filter = buildFilter('metadata.SYSKEYS', '==', keyword);
        return (
          <Chip
            key={keyword}
            label={formatOptionLabel(keyword)}
            component={Link}
            to={`/browse?${stringifyQuery({ filter })}`}
            clickable
            size="small"
            variant="outlined"
            className={style.chip}
          />
        );
      })}
    </DecoratedListItem>
  );
};

export default SystemKeywords;
