// React logic
import React, { useRef, useEffect, createRef } from 'react';

// Visual assets
import { Card, CardHeader, CardContent } from '@material-ui/core';

import {
  faStepBackward,
  faStepForward,
  faPause,
  faPlay,
  faExpand,
  faCompress,
  faSyncAlt,
  faVideo,
  faAdjust,
  faCube,
  faPaintBrush,
  faWalking,
  faRunning,
  faBiking,
  faTimes,
  faLock,
  faUnlock,
} from '@fortawesome/free-solid-svg-icons';
import {
  faDotCircle,
  faImages,
  faSquare,
} from '@fortawesome/free-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Icon } from '@material-ui/core';

import style from './style.module.css';

// All text to be displayed is set previously here
const documentation = [
  {
    id: 'ngl-viewer',
    header: 'NGL viewer',
    body: (
      <>
        NGL Viewer is a collection of tools for web-based molecular graphics.
        <br />
        <br />
        The BioExcel implementation of NGL viewer is a dynamic component useful
        to represent molecular structures and trajectories which the user can
        interact with.
        <br />
        <br />
        This component may be integrated in the web page structure (e.g. in the
        "trajectory" sheet) or an independent pop-up window which is draggable
        and resizable. To do so, hold left click in the window borders and drag.
        <br />
        <br />
        Use the mouse inside the NGL window to move the camera (hold right
        click), rotate the camera around its focus (hold left click) or zoom the
        camera (mouse wheel). Hover any atom with the mouse to get extra
        topology data (residue type and number, atom type and chain id) or left
        click on any atom to make the camera focus on it.
        <br />
        <br />
        Also some controls ara available under the NGL viewer in order to change
        other parameters:
        <br />
        <Icon>
          <FontAwesomeIcon icon={faTimes} />
        </Icon>{' '}
        (Only in pop-up) The "close" button is used to remove the whole NGL
        viewer pop-up window.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faUnlock} />
        </Icon>
        {' / '}
        <Icon color="disabled">
          <FontAwesomeIcon icon={faLock} />
        </Icon>{' '}
        (Only in pop-up) The "lock" button is used to make the current NGL
        viewer pop-up window stay as it is. So when a new selection is requested
        a new NGL window is opened instead of updating the locked window.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faStepBackward} />
        </Icon>
        {', '}
        <Icon>
          <FontAwesomeIcon icon={faStepForward} />
        </Icon>{' '}
        (Only with trajectory data) The "Previous frame" and "Next frame"
        buttons respectively are used to move through trajectory frames one by
        one.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faPlay} />
        </Icon>
        {' / '}
        <Icon>
          <FontAwesomeIcon icon={faPause} />
        </Icon>{' '}
        (Only with trajectory data) The "Play / Pause" button is used to start
        or stop the trajectory animation.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faExpand} />
        </Icon>
        {' / '}
        <Icon>
          <FontAwesomeIcon icon={faCompress} />
        </Icon>{' '}
        The "Enter / Exit full screen" button is used to make the NGL window
        expand to full screen or compress back to its normal size. User can also
        press "Esc" key to exit the full screen mode.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faSyncAlt} />
        </Icon>{' '}
        The "Toogle spin" button is used to make the camera slowly rotate around
        the y-axis.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faDotCircle} />
        </Icon>{' '}
        The "Center focus" button is used to make the camera return to its
        original focus.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faImages} />
        </Icon>
        {' / '}
        <Icon>
          <FontAwesomeIcon icon={faVideo} />
        </Icon>{' '}
        (Only with trajectory data) The "Smooth interpolation" button is used to
        smooth the jump between frames by adding extra frames in-between where
        the atom positions are interpolated.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faAdjust} />
        </Icon>{' '}
        The "Invert background color" button is used to switch background color
        between black and white.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faSquare} />
        </Icon>
        {' / '}
        <Icon>
          <FontAwesomeIcon icon={faCube} />
        </Icon>{' '}
        The "Orthographic / Perspective" button is used to change the view mode
        between 2D projection (orthographic or isometric) and 3D projection
        (perspective).
        <br />
        <Icon>
          <FontAwesomeIcon icon={faPaintBrush} />
        </Icon>{' '}
        The "Painter" button is used to set the drawing and coloring methods and
        the opacity of each representation.
        <br />
        <Icon>
          <FontAwesomeIcon icon={faWalking} />
        </Icon>
        {' / '}
        <Icon>
          <FontAwesomeIcon icon={faRunning} />
        </Icon>
        {' / '}
        <Icon>
          <FontAwesomeIcon icon={faBiking} />
        </Icon>{' '}
        The "Speed" bar is used to set how fast is the trajectory animation.
        <br />
        * Hover any button in the NGL window with the mouse to show a summary
        title.
        <br />
        <br />
        For more information about the original project, please check the
        oficial{' '}
        <a
          href="http://nglviewer.org/"
          target="_blank"
          rel="noreferrer noopener"
        >
          NGL viewer web page
        </a>
        .
      </>
    ),
  },
  {
    id: 'data-tables',
    header: 'Data tables',
    body: `Data tables are dynamic supports to handle large data sets display.
        These components allows to represent small subsets of data in a classic
         "rows and columns" format where the user can select the page and rows per
         page to be shown.`,
  },
  {
    id: 'rmsd-perres',
    header: 'RMSd per residue',
    body: `The RMSD (Root Mean Squared Deviation) per residue analysis computes the
        mean and standard deviation distance between the original position of each
        residue and their positions along each frame.
        This analysis is powered by PyTraj`,
  },
  // The following blocks are temporal
  {
    id: 'dist-perres-selector',
    header: 'Distance per residue selector',
    body: (
      <>
        This is the residues selector.
        <br />
        <br />
        Use this panel to select which residues are displayed in the heatmap
        below. Some default residue groups are provided by the authors (e.g.
        interface residues between two proteins).
      </>
    ),
  },
  {
    id: 'dist-perres-heatmap',
    header: 'Distance per residue heatmap',
    body: (
      <>
        This is the distance per residue representation.
        <br />
        <br />
        This heatmap represents the distance between selected residues from
        different proteins. Both horizontal and vertical edges stand for residue
        numbers. The color stands for the distance and it ranges from blue (far)
        to red (close). The legend below shows the corresponding values in
        angstroms.
        <br />
        <br />
        Use tabs over the heatmap to switch between mean and standard deviation.
        <br />
        <br />
        Click any cell on the heatmap to open an interactive window displaying
        the trajectory with the corresponding highlighted residues.
      </>
    ),
  },
  {
    id: 'electrostatic',
    header: 'Electrostatic potencial suerface',
    body: (
      <>
        This is the electrostatic potencial surface representation.
        <br />
        <br />
        The{' '}
        <a
          href="http://nglviewer.org/"
          target="_blank"
          rel="noreferrer noopener"
        >
          NGL viewer
        </a>{' '}
        represents the main structures and the interface surfaces between two
        interacting proteins. Surfaces are painted according the electrostatic
        potencial.
        <br />
        <br />
        Trajectory is not loaded in this context because the surface
        representation is too heavy to be updated dinamically.
      </>
    ),
  },
  {
    id: 'fluctuation-statistics',
    header: 'Fluctuation statistics table',
    body: (
      <>
        Statistics table including fluctuation data label, mean and standard
        deviation. Values are in namometers.
      </>
    ),
  },
  {
    id: 'fluctuation-graph',
    header: 'Fluctuation graph',
    body: (
      <>
        This graph represents the fluctuation of each atom. Data is displayed
        (more opaque lines) alongside corresponding mean value (light horizontal
        line) and mean ± 1 standard deviation (lighter horizontal bands)
        <br />
        <br />
        The horizontal edge stands for the atoms numeration.
        <br />
        The vertical edge stands for the flucutation in nanometers.
        <br />
        <br />
        The graph is interactive. Use the mouse to move along data by holding
        the click button and dragging left or right. Use the mouse wheel to zoom
        in a specific region. Click any point on the graph to open an
        interactive window displaying the trajectory with the corresponding atom
        highlighted.
      </>
    ),
  },
  {
    id: 'rmsd-statistics',
    header: 'RMSd statistics table',
    body: (
      <>
        Statistics table including RMSd data label, mean and standard deviation.
        Values are in namometers.
      </>
    ),
  },
  {
    id: 'rsmd-graph',
    header: 'RMSd graph',
    body: (
      <>
        This graph represents the RMSd in the average atom positions along the
        trajectory compared to the original position (frame 0). Data is
        displayed (more opaque lines) alongside corresponding mean value (light
        horizontal line) and mean ± 1 standard deviation (lighter horizontal
        bands).
        <br />
        <br />
        The horizontal edge stands for the trajectory time in nanoseconds.
        <br />
        The vertical edge stands for the RMSd in nanometers.
        <br />
        <br />
        The graph is interactive. Use the mouse to move along data by holding
        the click button and dragging left or right. Use the mouse wheel to zoom
        in a specific region. Click any point on the graph to open an
        interactive window to display the strucutre at the corresponding frame.
      </>
    ),
  },
  {
    id: 'hbonds-graph',
    header: 'Hydrogen bonds graph',
    body: (
      <>
        This is the hydrogen bonds analysis representation.
        <br />
        <br />
        The horizontal bars stand for the percent of frames along the trajectory
        in which the distance between each pair of atoms is inferior to 3
        angstroms.
        <br />
        <br />
        Click any bar in the graph to open an interactive window displaying the
        trajectory with the corresponding highlighted atoms.
      </>
    ),
  },
  {
    id: 'pca-eigen-graph',
    header: 'PCA eigenvalues graph',
    body: (
      <>
        This is the eigenvalues graph.
        <br />
        <br />
        The blue bars stand for the eigenvalue, according to the left edge, and
        the explained variance, according to the right edge, of any PCA
        projection. The yellow line stands for the accounting explained
        variance, according to the right edge.
        <br />
        <br />
        The graph is interactive. Hover any bar with the mouse to show the exact
        eigenvalue and explained variance values. Click one or more bars to
        select or deselect them. The exact eigenvalue and explained variance
        values of each selected bar will be permanently shown below the graph.
        Also, the accounting explained variance of all selected bars is
        displayed further below. In addition, if only one bar is selected then
        an NGL viewer will appear with the corresponding pca projection
        trajectory or eigen vector. If two bars are selected then the PCA
        projections are compared.
      </>
    ),
  },
  {
    id: 'pca-projection',
    header: 'PCA projection',
    body: (
      <>
        This is the selected projection representation.
        <br />
        <br />
        This component is an{' '}
        <a
          href="/help#/help#ngl-viewer"
          target="_blank"
          rel="noreferrer noopener"
        >
          NGL viewer
        </a>{' '}
        . It allows to represent a trajectory dinamically and interactively.
        <br />
        Use the mouse inside the NGL window to move, rotate or zoom the camera.
        You can get topology data of any atom by placing the mouse over it. Also
        some controls ara available under the NGL viewer in order to change the
        camera view, trajectory speed, protein representation colors, etc. Place
        the mouse over any button to show a summary title.
        <br />
        <br />
        Note that this is not the whole structure, but only the backbone. PCA
        analysis is performed only with backbone atoms for performance reasons.
      </>
    ),
  },
  {
    id: 'pca-projections-graph',
    header: 'PCA projections graph',
    body: (
      <>
        This is the PCA analysis comparing the two current selected projections.
        <br />
        <br />
        The color stands for the trajectory time.
        <br />
        <br />
        Click any point
      </>
    ),
  },
  {
    id: 'rgyr-statistics',
    header: 'Rgyr statistics table',
    body: (
      <>
        Statistics table including data label, mean and standard deviation
        values for the overall Rgyr and each dimension. Values are in
        namometers.
      </>
    ),
  },
  {
    id: 'rgyr-graph',
    header: 'Rgyr graph',
    body: (
      <>
        This graph represents the radius of gyration (Rgyr). There are four data
        sets: One three-dimensional (blue) and three single-dimensional radius.
        These are RgyrX (yellow), RgyrY (green) and RgyrZ (red). Data is
        displayed (more opaque lines) alongside corresponding mean value (light
        horizontal line) and mean ± 1 standard deviation (lighter horizontal
        bands)
        <br />
        <br />
        The horizontal edge stands for the trajectory time in nanoseconds.
        <br />
        The vertical edge stands for the Rgyr in nanometers.
        <br />
        <br />
        The graph is interactive. Use the mouse to move along data by holding
        the click button and dragging left or right. Use the mouse wheel to zoom
        in a specific region. Click any point on the graph to open an
        interactive window to display the strucutre at the corresponding frame.
      </>
    ),
  },
  {
    id: 'rmsd-pairwise-heatmap',
    header: 'RMSd pairwise heatmap',
    body: (
      <>
        This is the RMSd pairwise representation.
        <br />
        <br />
        This heatmap represents the RMSd in the average atom positions between
        each frame along the trajectory. Both horizontal and vertical edges
        stand for frame numbers. The color stands for the RMSd value and it
        ranges from blue (low) to red (high). The legend below shows the
        corresponding values in angstroms.
        <br />
        <br />
        Use tabs over the heatmap to switch between different RMSd pairwise
        analyses. Each analysis is calculated with a different selection of
        atoms/residues which have been suggested to be relevant by the authors.
        <br />
        <br />
        Click any cell on the heatmap to open an interactive window displaying
        both corresponding frames overlapped.
      </>
    ),
  },
  {
    id: 'rmsd-perres-selector',
    header: 'RMSd per residue selector',
    body: (
      <>
        This is the residues selector.
        <br />
        <br />
        Use this panel to select which residues are taken in count in the data
        table below and thus in the graph. Some default residue groups are
        provided by the authors (e.g. interface residues between two proteins).
      </>
    ),
  },
  {
    id: 'rmsd-perres-table',
    header: 'RMSd per residue data table',
    body: (
      <>
        This data table shows the selected residues list. First column contains
        residue name, which is composed by the union of the residue type
        abbreviation (e.g. ASN, ASP, CYS...) and the topology numeration. Next
        two columns provide the RMSD mean and standard deviation for each
        residue respectively. Both measures are in angstroms.
        <br />
        <br />
        Use this data table to navigate through all selected resiudes and set
        which of them must be displayed in the graph below. To do so, click in
        the first column checkbox of the residue to be shown/hidden.
      </>
    ),
  },
  {
    id: 'rmsd-perres-graph',
    header: 'RMSd per residue graph',
    body: (
      <>
        This graph represents the RMSd in the for each residue position along
        the trajectory compared to the original position (frame 0). Data is
        displayed (more opaque lines) alongside corresponding mean value (light
        horizontal line) and mean ± 1 standard deviation (lighter horizontal
        bands)
        <br />
        <br />
        The horizontal edge stands for the trajectory time in nanoseconds.
        <br />
        The vertical edge stands for the RMSd in nanometers.
        <br />
        <br />
        The graph is interactive. Use the mouse to move along data by holding
        the click button and dragging left or right. Use the mouse wheel to zoom
        in a specific region. Click any point on the graph to open an
        interactive window to display the strucutre at the corresponding frame
        with the specified highlighted residues.
      </>
    ),
  },
  {
    id: 'trajectory-ngl',
    header: 'Trajectory NGL viewer',
    body: (
      <>
        This is the main structure and trajectory representation.
        <br />
        <br />
        This component is an{' '}
        <a
          href="/help#/help#ngl-viewer"
          target="_blank"
          rel="noreferrer noopener"
        >
          NGL viewer
        </a>{' '}
        . It allows to represent a trajectory dinamically and interactively.
        <br />
        Use the mouse inside the NGL window to move, rotate or zoom the camera.
        You can get topology data of any atom by placing the mouse over it. Also
        some controls ara available under the NGL viewer in order to change the
        camera view, trajectory speed, protein representation colors, etc. Place
        the mouse over any button to show a summary title. In addition, this
        window is connected with the protein functional analysis below. You can
        select protein chains or domains and they will be highlighted.
        <br />
        <br />
        Note that this is not the whole trajectory, but a small subset of frames
        picked along the trajectory. Loading all frames is not allowed for
        performance reasons.
      </>
    ),
  },
  {
    id: 'trajectory-metadata',
    header: 'Trajectory NGL viewer',
    body: (
      <>
        This metadata is automatically mined from the original topology and
        trajectory files.
        <br />
        <br />
        Click in the 'trajectory metadata' title to display it. Hover any data
        field with the mouse to show a brief title.
      </>
    ),
  },
  {
    id: 'trajectory-chains',
    header: 'Trajectory NGL viewer',
    body: (
      <>
        Below you can see the families, domains, and sites, that an{' '}
        <a
          href="https://www.ebi.ac.uk/interpro/about/interproscan/"
          target="_blank"
          rel="noreferrer noopener"
        >
          InterProScan
        </a>{' '}
        analysis revealed for each of the chain sequences. This is a prediction
        that might be helpful to discover functions, or to find similar
        structures for example.
        <br />
        <br />
        You can interact with this visualisation as such:
        <br />
        <strong>Hover over their representation</strong> to see that some of
        them will have a corresponding page on the{' '}
        <a
          href="https://www.ebi.ac.uk/interpro/"
          target="_blank"
          rel="noreferrer noopener"
        >
          InterPro website
        </a>{' '}
        where you will be able to learn more about it.
        <br />
        <strong>Click on them</strong> to see the corresponding sequence
        highlighted in the interactive trajectory viewer above. Clicking on an
        other entity within the same chain will change the highlight to that
        other entity.
        <br />
        <strong>Click on an empty space</strong> in this visualisation to remove
        the highlight for that chain.
        <br />
        <strong>Scroll over the visualisation</strong> to zoom in or out of the
        chain sequence. Alternatively, you can also interact with the top
        navigation part (at the top of each visualisation) to zoom in and out or
        to move within the sequence.
      </>
    ),
  },
];

const Help = ({ location }) => {
  // References to all documentation blocks will be stored here
  const docRefs = useRef(Array(documentation.length).fill(createRef()));

  // Scroll down to the asked reference
  useEffect(() => {
    for (const ref of docRefs.current)
      if (location.hash === '#' + ref.id)
        return window.scrollTo(0, ref.offsetTop);
  }, [location.hash]);

  return documentation.map((doc, index) => (
    <Card
      key={index}
      id={doc.id}
      ref={r => (docRefs.current[index] = r)}
      className={style.card}
    >
      <CardHeader title={doc.header} />
      <CardContent>{doc.body}</CardContent>
    </Card>
  ));
};

export default Help;
