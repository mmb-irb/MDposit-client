import React from 'react';

import style from './style.module.css';

// One block of the statistics: a title, an optional subtitle, and the content below them
const Card = ({ title, subtitle, className, children }) => (
    <section className={className ? `${style.card} ${className}` : style.card}>
        <header className={style.cardHeader}>
            <h6 className={style.cardTitle}>{title}</h6>
            {subtitle && <p className={style.cardSubtitle}>{subtitle}</p>}
        </header>
        {children}
    </section>
);

export default Card;
