import React from 'react';
import { CardContent, Typography } from '@mui/material';

import Card from '../../components/animated-card';

import style from './style.module.css';

// Expose a link to get in touch with the IRB group
const Contact = () => (
  <Card className={style.card}>
    <CardContent className={style['card-content']}>
      <Typography variant="h5">Get in touch with us</Typography>
      See on the{' '}
      <a
        href="http://mmb.irbbarcelona.org/www/locationmap"
        target="_blank"
        rel="noopener noreferrer"
      >
        IRB Molecular Modeling and Bioinformatics group website
      </a>
      <br />
      Send a mail to{' '}
      <a href="mailto:daniel.beltran@irbbarcelona.org">
        daniel.beltran@irbbarcelona.org
      </a>
    </CardContent>
  </Card>
);

export default Contact;
