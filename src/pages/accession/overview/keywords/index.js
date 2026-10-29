import React from 'react';
import { Link } from 'react-router';
import { Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { formatOptionLabel } from 'src/utils/auxiliar-functions';
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
  const theme = useTheme();
  const parsedKeywords = parseKeywords(keywords);
  if (parsedKeywords.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div className={style['decorated-list-item__title']}>Keywords</div>
      <div className={style['decorated-list-item__content']} style={{ borderLeft: `.110rem solid ${theme.palette.secondary.dark}` }}>
        {parsedKeywords.map(keyword => {
          // Keep the keyword as stored, since the search matches it exactly
          const query = JSON.stringify({ 'metadata.SYSKEYS': keyword });
          return (
            <Chip
              key={keyword}
              label={formatOptionLabel(keyword)}
              component={Link}
              to={`/browse?query=${encodeURIComponent(query)}`}
              clickable
              size="small"
              variant="outlined"
              className={style.chip}
            />
          );
        })}
      </div>
    </div>
  );
};

export default SystemKeywords;
