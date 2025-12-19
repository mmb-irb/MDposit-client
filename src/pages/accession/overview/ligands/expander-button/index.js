import React, { useState } from 'react';

// Create a little button to show more or less of a paragraph
const ExpanderButton = ({ ligandReference, fieldName, maxLength = 400 }) => {
    const value = ligandReference[fieldName];
    const isTooLong = value.length > maxLength;
    const [expanded, setExpanded] = useState(!isTooLong);
    const toggleExpand = () => setExpanded(!expanded);
    const displayText = expanded ? value : `${value.substring(0, maxLength)}... `;
    return (
        <div>
            <div>
                {displayText.split('').map((char, index) => (
                    <span key={index} className="highlight">{char}</span>
                ))}
                {isTooLong && (
                    <button onClick={toggleExpand} 
                    className="ml-2 text-blue-500 hover:underline"
                    style={{
                        padding: '4px 6px',
                        borderRadius: '1.5px',
                        cursor: 'pointer',
                        display: 'inline-block',
                        fontSize: '14px',
                        margin: '2px 4px',
                    }}
                    >
                        {expanded ? 'See less' : 'See more'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default ExpanderButton;