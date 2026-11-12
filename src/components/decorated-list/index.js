import React from 'react';
import style from './style.module.css';

// A list of rows with a title and its content
// Titles share one column, so the lines between titles and contents stay aligned at any width
export const DecoratedList = ({ children }) => (
  <div className={style.list}>{children}</div>
);

// A row of a decorated list
// line - Draw a line between the title and the content
// breakWord - Break the content between words, splitting a word only when it does not fit
export const DecoratedListItem = ({ title, line = true, breakWord = false, children }) => {
  const contentClasses = [style.content];
  if (line) contentClasses.push(style.line);
  if (breakWord) contentClasses.push(style['break-word']);
  return (
    <div className={style.item}>
      <div className={style.title}>{title}</div>
      <div className={contentClasses.join(' ')}>{children}</div>
    </div>
  );
};
