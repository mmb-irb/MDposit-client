import { createContext } from 'react';

// These 3 context are used by React hooks
// They are accessed from different scripts (e.g. the accession page)
export const AccessionCtx = createContext(null);
export const ProjectCtx = createContext(null);
export const PdbCtx = createContext(null);
