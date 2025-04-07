import React, { useState, useEffect, useRef } from "react";
import RDKitHandler from "./rdkit_load";
import { Button } from "molstar/lib/mol-plugin-ui/controls/common";
import { add } from "lodash-es";

const MoleculeViewer = ({ smiles, fingerprintData, mol_block }) => {
  const [RDKit, setRDKit] = useState(null);
  const [selectedBit, setSelectedBit] = useState(null);
  const [highlightAtoms, setHighlightAtoms] = useState([]);
  const canvasRef = useRef(null); // Referencia para el canvas
  // Cargar RDKit al montar el componente
  useEffect(() => {
    RDKitHandler.load()
      .then((module) => setRDKit(module))
      .catch((error) => console.error("❌ Error al cargar RDKit:", error));
  }, []);

  // Actualizar los átomos resaltados cuando cambia el bit seleccionado
  useEffect(() => {
    if (selectedBit !== null && Array.isArray(fingerprintData[selectedBit])) {
      setHighlightAtoms(fingerprintData[selectedBit]); // ✅ No usar .map()
    } else {
      setHighlightAtoms([]);
    }
  }, [selectedBit, fingerprintData]);
  
  if (!fingerprintData || Object.keys(fingerprintData).length === 0) {
    return <p>No fingerprint data available</p>;
  }
  // style={{ color: "red" }}

  // Dibujar la molécula en el canvas
  useEffect(() => {
    if (!RDKit || !canvasRef.current) return;

    try {
      const mol = RDKit.get_mol(mol_block);
      const canvas = canvasRef.current;
      // const molBlock = mol.get_molblock();
      // const mol2 = RDKit.get_mol(molBlock);
      // console.log("mol2:", mol2);
      // console.log("molBlock:", molBlock);

      // All the canvas options: https://www.rdkitjs.com/#drawing-molecules-canvas
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = window.innerWidth;     // equals window dimension
      canvas.height = window.innerHeight;
      mol.draw_to_canvas_with_highlights(canvas, JSON.stringify({
        atoms: highlightAtoms,
        highlightRadius: 0.6,
        highlightColor: [1, 0, 0], // Rojo (RGB)
        addAtomIndices: true,
        explicitMethyl: true
      }));
    } catch (error) {
      console.error("❌ Error al renderizar la molécula:", error);
    }
  }, [RDKit, smiles, highlightAtoms]);

  return (
    <div style={{  alignItems: "center", width: "100%" }}>
      <canvas ref={canvasRef} style={{ width: "100%", maxWidth: "400px", height: "auto" }} />
      <div style={{ marginTop: "10px",  alignItems: "center" }}>
        <label htmlFor="fragmentSelector" style={{ marginBottom: "5px" }}>Select a fragment:  </label>
        <select id="fragmentSelector" onChange={(e) => setSelectedBit(parseInt(e.target.value) || null)} value={selectedBit || ""}>
          <option value="">None</option>
          {Object.keys(fingerprintData).map((bit) => (
            <option key={bit} value={bit}>
              Number {bit}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default MoleculeViewer;
