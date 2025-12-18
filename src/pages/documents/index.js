// React logic
import React from 'react';

// Visual assets
import { Typography } from '@mui/material';
import TextLink from '../../components/text-link';

// A specific page for MDDB documentation
const Documents = () => (
    <div style={{ margin: '1em' }}>
    <Typography variant="h4" >MDDB documents</Typography>
    <br />
    Here is a summary of MDDB official documentation including policies,
    licensing and terms of use.<br />
    <br />
    <b>MDDB software license</b><br />
    <br />
    Individual source code is provided under {' '}<TextLink name={'Apache2 license'}
        url={'https://www.apache.org/licenses/LICENSE-2.0.html'}
    /> for all the {' '}<TextLink name={'components'} page={'software'}/>,
    including the source code of the MDDB workflow.<br />
    <br />
    MDDB workflow packaging (with the required dependencies) is distributed under the
    {' '}<TextLink name={'GPL-3 license'}
        url={'https://www.gnu.org/licenses/gpl-3.0.en.html'}
    />.<br />
    <br />
    <b>MDDB data license</b><br />
    <br />
    MDDB data is distributed under the <TextLink name={'CC BY 4.0 license'}
        url={'https://creativecommons.org/licenses/by/4.0/'}
    />. During the upload process,
    users must explicitly agree to these terms by selecting a checkbox,
    which is accompanied by a link to the full license text.<br />
    <br />
    {'- '}<TextLink
        name={'MDDB Data Deposition Policies'}
        url={'https://drive.google.com/file/d/1W5M1i9TUqxWRbRiDyFV0GA9aK9CEVQUa/view?usp=sharing'}
    /><br />
    <br />
    {'- '}<TextLink
        name={'MDDB Metadata Specification'}
        url={'https://drive.google.com/file/d/1o4xX3ke1jLGrcEo8izIv8osh6vrZqXRb/view?usp=sharing'}
    /><br />
    <br />
    {'- '}<TextLink
        name={'MDDB Federated Node Implementation Policy - HPC Centers'}
        url={'https://drive.google.com/file/d/1c1He4k-tppM24RwSfK-6U1pXN1SJXdBh/view?usp=sharing'}
    /><br />
    <br />
    {'- '}<TextLink
        name={'MDDB Federated Node Implementation Policy - Research Groups'}
        url={'https://drive.google.com/file/d/1TslBWbHroHA1ju_-yAc23RxCfBXDHkJi/view?usp=sharing'}
    /><br />
    </div>
);

export default Documents;
