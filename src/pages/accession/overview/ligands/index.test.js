import React from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { ProjectCtx } from 'src/contexts';
import LigandsOverview from '.';

afterEach(cleanup);

// A reference already mined by the workflow, so no request is sent to PubChem
const reference = (name, inchikey) => ({
  name,
  inchikey,
  pubchem: String(inchikey.length * 1000 + name.length),
  version: '0.1.0',
  smiles: 'CCO',
  formula: 'C2H6O',
});

// Topology residues pointing to their references, as the topology manager does
const topologyWith = residues => ({
  *iterresidues() {
    for (const [name, referenceId] of residues) yield { name, referenceId };
  },
});

const renderLigands = (references, residues) =>
  render(
    <MemoryRouter>
      <ProjectCtx.Provider
        value={{ metadata: {}, ligandAndLipidReferences: references, topology: topologyWith(residues) }}
      >
        <LigandsOverview />
      </ProjectCtx.Provider>
    </MemoryRouter>,
  );

const rowNames = () =>
  screen.getAllByRole('button', { expanded: false }).map(row => row.textContent);

describe('<LigandsOverview />', () => {
  const four = [
    reference('Zeta', 'KEYA'),
    reference('Alpha', 'KEYCC'),
    reference('Beta', 'KEYBBB'),
    reference('Gamma', 'KEYDDDD'),
  ];
  const residues = [['AAA', 'KEYA'], ['CCC', 'KEYCC'], ['BBB', 'KEYBBB']];

  it('shows more than 3 references as closed rows, sorted by residue name', () => {
    renderLigands(four, residues);
    const rows = rowNames();
    expect(rows).toHaveLength(4);
    // References with no residue go last
    ['AAA', 'BBB', 'CCC', 'Gamma'].forEach((start, i) => expect(rows[i]).toContain(start));
    expect(rows[0]).toContain('Zeta');
    // Details stay closed
    expect(screen.queryByText('SMILES')).toBeNull();
  });

  it('opens the full details of a row when it is clicked, and closes them again', () => {
    renderLigands(four, residues);
    const row = screen.getAllByRole('button', { expanded: false })[1];
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('SMILES')).toHaveLength(1);
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('SMILES')).toBeNull();
  });

  it('shows up to 3 references in full, sorted by name as before', () => {
    renderLigands(four.slice(0, 3), residues);
    expect(screen.queryAllByRole('button', { expanded: false })).toHaveLength(0);
    expect(screen.getAllByText('SMILES')).toHaveLength(3);
    const titles = screen.getAllByRole('heading').map(heading => heading.textContent);
    expect(titles).toEqual(['Alpha', 'Beta', 'Zeta']);
  });

  it('keeps references which share a residue name apart', () => {
    renderLigands(
      [...four, reference('Cholesterol', 'KEYEEEEE'), reference('Cholesterol-3-13C', 'KEYFFFFFF')],
      [...residues, ['CHOL', 'KEYEEEEE'], ['CHOL', 'KEYFFFFFF']],
    );
    const chol = rowNames().filter(row => row.includes('CHOL'));
    expect(chol).toHaveLength(2);
    expect(within(screen.getByText('Cholesterol-3-13C').closest('button')).getByText('CHOL')).toBeTruthy();
  });
});
