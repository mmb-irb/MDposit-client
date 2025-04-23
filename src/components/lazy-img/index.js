import React from 'react';
import fallbackImage from '../../images/random_molecule.png';  

// Comments here are for typescript
/**
 * @param {ImgAttr} param0
 */
const LazyImg = ({ loading = 'auto', alt, ...props }) => (
  // @ts-ignore
  <img loading={loading} alt={alt} {...props} 
  onError={(e) => (e.currentTarget.src = fallbackImage)}/>
);

export default LazyImg;
