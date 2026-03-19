import React, { useState } from 'react';

// Create a little button to show more or less of a paragraph
const ExpanderButton = ({ text, maxLength = 400 }) => {
    const isTooLong = text.length > maxLength;
    const [expanded, setExpanded] = useState(!isTooLong);
    const toggleExpand = () => setExpanded(!expanded);
    const displayText = expanded ? text : `${text.substring(0, maxLength)}...`;
    return (<>
        <span className="highlight">{displayText}</span>
        {isTooLong && <span onClick={toggleExpand} style={{ cursor: 'pointer', color: '#0000FF' }}>{
            expanded ? ' See less' : ' See more'
        }</span>}
    </>);
};

export default ExpanderButton;