import React, { useEffect, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import style from './style.module.css';

/**
 * SimpleHistogram — renders a horizontal bar chart.
 *
 * @param {Array} data - Array of { label, value, percentage } objects.
 * @param {string} [color] - Bar fill color. Defaults to the theme secondary dark color.
 * @param {boolean} [showPercentage] - Whether to show percentage labels. Defaults to true.
 */
const SimpleHistogram = ({ data, color, showPercentage = true }) => {
    const theme = useTheme();
    const barColor = color || theme.palette.secondary.dark;

    // Start bars at 0% so the CSS transition animates on first render
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        // requestAnimationFrame ensures the 0%-width paint is committed before we
        // flip to the real widths, giving the CSS transition something to animate from
        const raf = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(raf);
    }, []);

    if (!data || data.length === 0) return null;

    return (
        <div>
            {data.map((item, index) => (
                <div key={index} className={style['chart-bar-container']}>
                    <div className={style['chart-bar-header']}>
                        <span>{item.label}</span>
                        <span className={style['chart-bar-value']}>
                            {item.value.toLocaleString()}
                            {showPercentage && ` (${item.percentage}%)`}
                        </span>
                    </div>
                    <div className={style['chart-bar-background']}>
                        <div
                            className={style['chart-bar-fill']}
                            style={{ width: mounted ? `${item.percentage}%` : '0%', backgroundColor: barColor }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SimpleHistogram;
