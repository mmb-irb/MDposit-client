// React logic
import React from 'react';

// Visual assets
import Card from '../../components/animated-card';
import { CardContent, Typography } from '@mui/material';
import LazyImg from '../../components/lazy-img';
import TextLink from '../../components/text-link';
// This allows to render markdown
import ReactMarkdown from 'react-markdown'
// Import CSS style
import style from './style.module.css';

// Image with the schema of all docker containers
import containersImage from '../../images/containers_schema.png';

// Set some markdown badges
// Gallery -> https://ileriayo.github.io/markdown-badges/
const GITHUB_BADGE = '![GitHub repository](https://badgen.net/badge/icon/github?icon=github&label)';

// set software URLs
const SOFTWARE = {
    dockers: {
        description: 'Docker orchestrator used to install and manage all containerized MDDB components in a node.',
        url: 'https://github.com/mmb-irb/MDDB-docker',
    },
    workflow: {
        description: 'Python tool to process raw MD data, run quality control checkings and then analyze it. The workflow relies in many thrid-party software dependencies.',
        url: 'https://github.com/mmb-irb/MDDB-workflow',
    },
    loader: {
        description: 'NodeJS tool to upload output data from the workflow into a Mongo database and further data handling.',
        url: 'https://github.com/mmb-irb/MDDB-loader',
    },
    api: {
        description: 'NodeJS REST API. It serves data from a Mongo database through a programmatic interface.',
        url: 'https://github.com/mmb-irb/MDDB-REST-API',
    },
    client: {
        description: 'React web client. It feeds on the API and serves data thorugh a graphical user-friendly interface.',
        url: 'https://github.com/mmb-irb/MDDB-REST-API',
    },
}

// A specific page for MDDB documentation
const Software = () => (
    <div style={{ margin: '1em' }}>
        <Typography variant="h4" >MDDB software</Typography>
        <br />
        Here is a list of MDDB software components, which make possible the MDposit service.<br />
        Most of these components are containerized using {' '}
        <TextLink name={'docker'} url={'https://www.docker.com/'}/>.<br />
        <br />
        <LazyImg src={containersImage} loading="lazy" alt="" />
        {Object.entries(SOFTWARE).map(([name, properties]) =>
            <Card className={style.card} key={name}>
                <CardContent>
                    <div className={style.horizontal}>
                        <Typography variant="h6" >{name}</Typography>
                        <ReactMarkdown
                            children={`[${GITHUB_BADGE}](${properties.url})`}
                            linkTarget="_blank"
                            className={style.badge}
                        />
                    </div>
                    {properties.description}
                </CardContent>
            </Card>
        )}
        <br />
        Individual source code is provided under {' '}<TextLink name={'Apache2 license'}
            url={'https://www.apache.org/licenses/LICENSE-2.0.html'}
        /> for all the components, including the source code of the MDDB workflow.<br />
        MDDB workflow packaging (with the required dependencies) is distributed under the
        {' '}<TextLink name={'GPL-3 license'}
            url={'https://www.gnu.org/licenses/gpl-3.0.en.html'}
        />.<br />
    </div>
);

export default Software;
