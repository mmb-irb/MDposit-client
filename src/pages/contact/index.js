import React from 'react';
import { CardContent, Typography, Icon } from '@mui/material';
import { faGlobe, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import Card from '../../components/animated-card';

import style from './style.module.css';

import { HOST_CONFIG } from "src/utils/constants";

// Expose a link to get in touch with the IRB group
const Contact = () => (
    <Card className={style.card}>
        <CardContent className={style['card-content']}>
            <Typography variant="h4" className={style['margined-bottom']}>
                Get in touch
            </Typography>
            {HOST_CONFIG.contactText && <div>
                {HOST_CONFIG.contactText}
                <br />
                <br />
            </div>}
            {HOST_CONFIG.contactUrls.length > 0 && 'Visit our website:'}
            {HOST_CONFIG.contactUrls.map((urlConfig, i) =>
                <Card key={i} className={style.card}>
                    <CardContent className={style.horizontal}>
                        <Icon className={style['margined-horizontal']}>
                            <FontAwesomeIcon icon={faGlobe} />
                        </Icon>
                        <div>
                            {urlConfig.label && <Typography variant="h6">
                                {urlConfig.label}
                            </Typography>}
                            <a
                                href={urlConfig.url}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {urlConfig.url}
                            </a>
                        </div>
                        
                    </CardContent>
                </Card>
            )}
            {HOST_CONFIG.contactMails.length > 0 && 'Send us a mail:'}
            {HOST_CONFIG.contactMails.map((mailConfig, i) =>
                <Card key={i} className={style.card}>
                    <CardContent className={style.horizontal}>
                        <Icon className={style['margined-horizontal']}>
                            <FontAwesomeIcon icon={faEnvelope} />
                        </Icon>
                        <div>
                            {mailConfig.label && <Typography variant="h6">
                                {mailConfig.label}
                            </Typography>}
                            <a
                                href={`mailto:${mailConfig.mail}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {mailConfig.mail}
                            </a>
                        </div>
                        
                    </CardContent>
                </Card>
            )}
        </CardContent>
    </Card>
);

export default Contact;
