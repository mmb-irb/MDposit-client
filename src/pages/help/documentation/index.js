// React logic
import React from 'react';

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

// Ser a simpler link component
const Link = ({ name, id, url }) => (
  <>
    {' '}
    <a
      href={id ? `/help#/help#${id}` : url}
      target="_blank"
      rel="noreferrer noopener"
    >
      {name}
    </a>{' '}
  </>
);

// All text to be displayed is set previously here
const documentation = [
  {
    id: 'analyses',
    title: 'Analyses',
  },
  {
    id: 'rmsds',
    header: 'RMSds',
    body: (
      <>
        RMSds page includes both <Link name={'RMSd'} id={'rmsd'} /> and
        <Link name={'TM score'} id={'tm-score'} /> analyses together.
      </>
    ),
    page: (
      <>
        This is the RMSDs analysis.
        <br />
        <br />
        This page includes both RMSD and TM score analyses together. Each
        analysis has been run against the first frame and against the average
        structure of the whole trajectory. Use tabs above the first table to
        switch between those analyses.
        <br />
        <br />
        RMSD analyses have been run over different protein atom selections: all
        protein atoms (protein), heavy atoms (protein-h), backbone and protein
        alpha carbon (c-alpha). First table displays the mean and standard
        deviation values of each atoms selection in Ångstroms (Å). In addition,
        there is a checkbox next to each atom selection name which allows to
        hide or show data in the graph below.
        <br />
        <br />
        Graph displays the RMSD/TM score value in each frame along the
        trajectory. The horizontal axis stands for the trajectory time in
        nanoseconds. The vertical axis may stand for the RMSd in Ångstroms (Å)
        or the TM score. The graph is{' '}
        <span style={{ color: 'lightGreen' }}>interactive</span>. Use the mouse
        wheel to zoom in a specific region. Click and hold at any point in the
        graph to drag it left or right. Hover any point in the graph to show the
        corresponding RMSD/TM score and time values. Click any point in the
        graph to open a{' '}
        <a
          href="/help#/help#ngl-viewer"
          target="_blank"
          rel="noreferrer noopener"
        >
          viewer
        </a>{' '}
        showing the structure conformation at the selected time frame.
      </>
    ),
  },
  {
    id: 'rmsd',
    header: 'RMSd',
    body: (
      <>
        RMSd analyses have been run against the first frame and against the
        average structure of the whole trajectory. RMSd analyses have been run
        over different protein atom selections: all protein atoms (protein),
        heavy atoms (protein-h), backbone and alpha carbon (c-alpha). The RMSd
        value of the sturcutre is stored on each frame along the trajectory.
        <br />
        <br />
        This analysis is powered by{' '}
        <Link name={'Gromacs'} url={'https://www.gromacs.org/'} />
      </>
    ),
  },
  {
    id: 'tm-score',
    header: 'TM score',
    body: (
      <>
        TM score analyses are run against the first frame and against the
        average structure of the whole trajectory. TM score analyses are run
        over alpha carbon atoms. The TM score value of the sturcutre is stored
        on 100 frames along the trajectory.
        <br />
        <br />
        This analysis is powered by the{' '}
        <Link name={'tmscoring'} url={'https://pypi.org/project/tmscoring/'} />
        python module. Click{' '}
        <Link
          name={'here'}
          url={'https://zhanglab.ccmb.med.umich.edu/TM-score/'}
        />
        to learn more about TM score.
      </>
    ),
  },
  {
    id: 'rmsd-perres',
    header: 'RMSd per residue',
    body: (
      <>
        The RMSD (Root Mean Squared Deviation) per residue analysis computes the
        mean and standard deviation distance between the original position of
        each residue (first frame) and their positions along each frame.
        <br />
        <br />
        This analysis is powered by{' '}
        <Link
          name={'PyTraj'}
          url={'https://amber-md.github.io/pytraj/latest/index.html#'}
        />
      </>
    ),
    page: (
      <>
        This is the RMSd per residue analysis.
        <br />
        <br />
        RMSd values are calculated against the trajectory first frame. First
        panel is the residue selector. Residues are divided by chains. Chains
        are delimited by their titles and residues may be expanded or compressed
        for each chain independently. Each residue is represented by a single
        letter. The 'X' letter represents non-standard residues (i.e. not
        natural aminoacids). Residues sequence is split and numerated every 10
        resiudes. Each residue is coloured according to its RMSD value. The
        color scale ranges from white (lowest values) to red (highest values).
        <span style={{ color: 'lightGreen' }}> Click any residue </span> to
        display its RMSD along the trajectory and highlight its atoms on the NGL
        viewer. Multiple residues may be selected at the same time. In this
        case, each selected residue is tagged with a different color.
        <br />
        <br />
        Graph at bottom left displays the RMSD of selected residues. Y axis
        represents the RMSD value in Ångstroms (Å) while X axis represents the
        simulation time in nanoseconds (ns). The graph is{' '}
        <span style={{ color: 'lightGreen' }}>interactive</span>. Use the mouse
        wheel to zoom in a specific region. Click and hold at any point in the
        graph to drag it left or right. Hover any point in the graph to show the
        corresponding RMSD and time values. Click any point in the graph to make
        the NGL viewer represent the corresponding time frame.
        <br />
        <br />
        <a
          href="/help#/help#ngl-viewer"
          target="_blank"
          rel="noreferrer noopener"
        >
          viewer
        </a>{' '}
        at the right bottom shows the trajectory. The structure is coloured
        according to residue RMSD values. The color scale ranges from white
        (lowest values) to red (highest values).
      </>
    ),
  },
  {
    id: 'rmsd-pairwise',
    header: 'RMSd pairwise',
    page: (
      <>
        This is the RMSd pairwise analysis.
        <br />
        <br />
        A RMSD pairwise analysis is run for all residues (Overall), which is the
        deafult displayed analysis. However, another analysis is run for every
        defined interaction, where interface residues are considered. Use
        'Residues selector' over the heatmap to select the analysis to be
        displayed.
        <br />
        <br />
        Heatmap represents the RMSd between each pair of frames along the
        trajectory. Both horizontal and vertical axes stand for frame numbers.
        The color stands for the RMSd value and it ranges from blue (low) to red
        (high). The legend below shows the corresponding values in Ångstroms
        (Å). The heatmap is{' '}
        <span style={{ color: 'lightGreen' }}>interactive</span>. Hover any cell
        to show a tooltip with the pair of corresponding frames and the RMSD
        value between them. Click any cell on the heatmap to open a{' '}
        <a
          href="/help#/help#ngl-viewer"
          target="_blank"
          rel="noreferrer noopener"
        >
          viewer
        </a>{' '}
        displaying both corresponding frames overlapped. The horizontal axis
        frame is coloured in red while the vertical axis frame is coloured in
        blue.
      </>
    ),
  },
  {
    id: 'rgyr',
    header: 'Radius of gyration',
    page: (
      <>
        This is the Radius of gyration (Rgyr) analysis.
        <br />
        <br />
        There are four data sets: One three-dimensional (blue) and three
        single-dimensional radius. These are RgyrX (yellow), RgyrY (green) and
        RgyrZ (red). Statistics table includes data label, mean and standard
        deviation values for the overall Rgyr and each dimension. Values are in
        Ångstroms (Å).
        <br />
        <br />
        Graph displays the 4 Rgyr dataset values for each frame along the
        trajectory. Data is displayed (more opaque lines) alongside
        corresponding mean value (light horizontal line) and mean ± 1 standard
        deviation (lighter horizontal bands). The horizontal axis stands for the
        trajectory time in nanoseconds. The vertical axis stands for the Rgyr in
        Ångstroms (Å). The graph is{' '}
        <span style={{ color: 'lightGreen' }}>interactive</span>. Use the mouse
        wheel to zoom in a specific region. Click and hold at any point in the
        graph to drag it left or right. Hover any point in the graph to show the
        corresponding Rgyr and time values. Click any point in the graph to open
        a{' '}
        <a
          href="/help#/help#ngl-viewer"
          target="_blank"
          rel="noreferrer noopener"
        >
          viewer
        </a>{' '}
        showing the structure conformation at the selected time frame.
      </>
    ),
  },
  {
    id: 'fluctuation',
    header: 'Fluctuation',
    page: (
      <>
        This is the atoms fluctuation analysis
        <br />
        <br />
        Statistics table includes fluctuation data label, mean and standard
        deviation. Values are in Ångstroms (Å).
        <br />
        <br />
        Graph below represents the fluctuation of each atom. Data is displayed
        (more opaque lines) alongside corresponding mean value (light horizontal
        line) and mean ± 1 standard deviation (lighter horizontal bands). The
        horizontal axis stands for the atoms numeration. The vertical axis
        stands for the flucutation in Ångstroms (Å). The graph is{' '}
        <span style={{ color: 'lightGreen' }}>interactive</span>. Use the mouse
        wheel to zoom in a specific region. Click and hold at any point in the
        graph to drag it left or right. Click any point in the graph to open a{' '}
        <a
          href="/help#/help#ngl-viewer"
          target="_blank"
          rel="noreferrer noopener"
        >
          viewer
        </a>{' '}
        showing the trajectory with selected atoms and their residues
        highlighted. Multiple atoms may be selected at the same time. Hover any
        point in the graph to show the highlighted atom in the viewer if it is
        already opened. The 'Clear selection' button below removes all graph
        selections and the viewer.
      </>
    ),
  },
  {
    id: 'dist-perres',
    header: 'Distance per residue',
    page: (
      <>
        This is the Distance per residue analysis.
        <br />
        <br />
        A distance per residue analysis is run for each interaction, recording
        the mean and standard deviation of distances along the trajectory
        between each residue in each different interaction agent. Use this panel
        to select which interaction residues are displayed in the heatmap below.
        Only the interaction interface residues are shown by default, but also
        all residues may be displayed (i.e. all residues of each interacting
        agent).
        <br />
        <br />
        Heatmap represents the mean distance between the geometric center of
        selected residues from different interacting agents along the
        trajectory. Both horizontal and vertical axes stand for residue numbers.
        The color stands for the distance and it ranges from blue (far) to red
        (close). The legend below shows the corresponding values in Ångstroms.
        Use tabs over the heatmap to switch between the mean distance and the
        standard deviation. The heatmap is{' '}
        <span style={{ color: 'lightGreen' }}>interactive</span>. Hover any cell
        to show a tooltip with the pair of corresponding residues and the mean
        distance / standard deviation value between them. Click any cell on the
        heatmap to open a{' '}
        <a
          href="/help#/help#ngl-viewer"
          target="_blank"
          rel="noreferrer noopener"
        >
          viewer
        </a>{' '}
        displaying the trajectory with both corresponding residues highlighted.
      </>
    ),
  },
  {
    id: 'electrostatic',
    header: 'Electrostatic potencial suerface',
    page: (
      <>
        This is the electrostatic potencial surface representation.
        <br />
        <br />
        Use the 'Interaction' selector to change the represented interaction in
        the{' '}
        <a
          href="http://nglviewer.org/"
          target="_blank"
          rel="noreferrer noopener"
        >
          NGL viewer
        </a>{' '}
        below. By default, the interface residues from one of the interacting
        agents is represented in electrostatic surface mode and the interface
        residues from the other agent is represented in balls and sticks
        coloured by element. The rest of the structure is represented in low
        opacity grey cartoon. Both the 'surfaced' and the 'sticked' agent names
        are shown next to the interaction selector. The representation of both
        agent interfaces may be switched with the toogle button between their
        names.
        <br />
        <br />
        Note that trajectory is not loaded in this context because the surface
        representation is too heavy to be updated dinamically. The first frame
        is loaded instead.
      </>
    ),
  },
  {
    id: 'hbonds',
    header: 'Hydrogen bonds',
    body: `Two atoms
      are considered to form an hydrogen bond when the distance between them
      is inferior to 3 Ångstroms and the 'acceptor atom - hydrogen - donor
      atom' angle is superior to 15 degrees.`,
    page: (
      <>
        This is the hydrogen bonds analysis.
        <br />
        <br />
        A hydrogen bonds analysis is run for each defined interaction. Use the
        'Interaction' selector to switch between these analyses.
        <br />
        <br />
        Graph below displays when the hydrogen bond was predicted to happen
        (blue) or not (light grey) between each pair of atoms along the
        trajectory. Pairs of hydrogen bridging atoms are listed in order of
        stability. Hydrogen bonds which happen less than an 1% of the total
        trajectory time are not listed. Left axis represents the different
        hydrogen bonds. Labels describe the acceptor and donor atoms
        respectively. Horizontal axis represents trajectory frames. Over the
        graph there is a legend of chain names.
        <br />
        <br />
        The graph is <span style={{ color: 'lightGreen' }}>interactive</span>.
        Click any horizontal bar to open a{' '}
        <a
          href="/help#/help#ngl-viewer"
          target="_blank"
          rel="noreferrer noopener"
        >
          viewer
        </a>{' '}
        showing the trajectory with the selected pair of atoms and their
        residues highlighted. Also the distance between those atoms is
        represented. In addition, the hydrogen which is expected to form the
        hydrogen bond is also highlighted and the angle formed by the acceptor
        atom, the bridging hydrogen and the donor atom is represented.
      </>
    ),
  },
  {
    id: 'energies',
    header: 'Energies',
    page: (
      <>
        Graphs represent from top to bottom the electrostatic potential, the Van
        der Waals forces and the sum of both values per each residue
        respectively. Energies are calculated for each atom individually and
        then added by residues. Averages are calculated from 100 selected frames
        along the trajectory. In addition, two more averages are calculated: the
        average for the frist 20 frames of the 100 selected frames and the
        average for the last 20 frames. These averages are represented in red
        and blue colors respectively. Horizontal axes stand for the main protein
        residues numbers. Vertical axes stand for the residue potential in
        kcal/mol.
        <br />
        <br />
        Graphs are <span style={{ color: 'lightGreen' }}>interactive</span>. Use
        the mouse wheel to zoom in a specific region. Click and hold at any
        point in the graph to drag it left or right. Click any point in the
        graph to open a{' '}
        <a
          href="/help#/help#ngl-viewer"
          target="_blank"
          rel="noreferrer noopener"
        >
          viewer
        </a>{' '}
        displaying the trajectory with the corresponding highlighted residue.
      </>
    ),
  },
  {
    id: 'pockets',
    header: 'Pockets',
    page: (
      <>
        This is the pockets analysis.
        <br />
        <br />
        Only the ten most stable pockets are analyzed. Left table lists these
        pockets and their average volume along the trajectory. Click any pocket
        row in the table to highlight and focus this pockets in the viewer.
        Click any checkbox in the table to hide/show the corresponding pocket.
        <br />
        <br />
        Right{' '}
        <a
          href="/help#/help#ngl-viewer"
          target="_blank"
          rel="noreferrer noopener"
        >
          viewer
        </a>{' '}
        shows the listed pockets. Pockets are labeled according to their table
        name. The represented pockets surfaces are average surfaces and they do
        not change when the time / frame of the viewer is modified. Selected
        pocket is coloured in yellow while other pockets are coloured in blue.
        In addition, the surface of atoms which form the selected pockets is
        also represented and it is coloured by electrostatic potential. Each
        pocket atoms are always the same along the trajectory.
        <br />
        <br />
        Graph below displays the selected pocket volume along the trajectory.
        Left axis represents the pocket volume in cubic Ångstroms (Å
        <sup>{3}</sup>). Horizontal axis represents trajectory frames. The graph
        is <span style={{ color: 'lightGreen' }}>interactive</span>. Click any
        point to represent the corresponding frame in the viewer.
      </>
    ),
  },
  {
    id: 'mutations',
    header: 'Mutations',
    page: (
      <>
        This is the mutations analysis.
        <br />
        <br />
        Entropies of each residue were obtained from the{' '}
        <a
          href="https://nextstrain.org/ncov/global"
          target="_blank"
          rel="noreferrer noopener"
        >
          Nextstrain
        </a>{' '}
        database.
        <br />
        <br />
        The{' '}
        <a
          href="/help#/help#ngl-viewer"
          target="_blank"
          rel="noreferrer noopener"
        >
          viewer
        </a>{' '}
        below represents the entropy of each residue in a logarithmic color
        scale which ranges from grey (low entropy) to red (high entropy). Use
        the residue selector to highlight a specific residue and focus it with
        the camera.
      </>
    ),
  },
  {
    id: 'epitopes',
    header: 'Epitopes',
    page: (
      <>
        This is the epitopes viewer.
        <br />
        <br />
        Epitopes present in the structure are listed left. The list includes the
        PDB code of the corresponding SARS-CoV-2 + human antibody structure and
        the average Solvent Accessible Surface (SAS) of all epitope residues
        together along the trajectory for each chain. Epitopes can be
        represented in the{' '}
        <a
          href="/help#/help#ngl-viewer"
          target="_blank"
          rel="noreferrer noopener"
        >
          viewer
        </a>{' '}
        at right, over the overall structure in low opacity black color. Hover
        any epitope to display its residues in yellow color. Click on any
        epitope checkbox to display its residues in a specific color and also
        the average SAS of its residues together along the trajectory in the
        graph below. Lines of each epitope are represented with a different
        color. The line of each chain is represented with a different dash
        pattern. Click anywhere on the graph to change the viewer trajectory
        frame.
        <br />
        <br />
        Several epitopes may be selected in order to compare them. Note that if
        overlapping epitopes are selected then epitopes above in the list will
        eclipse epitopes below in the viewer. Click on the overall pockets
        checkbox to represent the overall epitopes representation.
      </>
    ),
    body: (
      <>
        Epitopes were mined from the{' '}
        <a
          href="https://www.rcsb.org/"
          target="_blank"
          rel="noreferrer noopener"
        >
          PDB
        </a>{' '}
        . A systematic search was performed with the parameters 'Source Organism
        Taxonomy Name' equals 'SARS-CoV-2' + 'Homo sapiens' and 'Additional
        Structure Keywords' contains phrase 'antibody'. Last search was
        performed on June 2021 with more than 150 results. For each structure,
        SARS-CoV-2 interface residues with the human antibody were captured by
        using a distance cutoff of 5 Ångstroms between atoms.
      </>
    ),
  },
  {
    id: 'sasa',
    header: 'Solvent accessible surface',
    page: (
      <>
        This is the Solvent accessible surface analysis.
        <br />
        <br />
        First panel is the residue selector. Residues are divided by chains.
        Chains are delimited by their titles and residues may be expanded or
        compressed for each chain independently. Each residue is represented by
        a single letter. The 'X' letter represents non-standard residues (i.e.
        not natural aminoacids). Residues sequence is split and numerated every
        10 resiudes. Each residue is coloured according to its SAS per atom
        value. The color scale ranges from white (lowest values) to red (highest
        values).
        <span style={{ color: 'lightGreen' }}> Click any residue </span> to
        display its SAS per atom along the trajectory and highlight its atoms on
        the NGL viewer. Multiple residues may be selected at the same time. In
        this case, each selected residue is tagged with a different color.
        <br />
        <br />
        Graph at bottom left displays the SAS per atom of selected residues. Y
        axis represents the surface in squared Ångstroms (Å<sup>{2}</sup>) while
        X axis represents the simulation time in nanoseconds (ns). The graph is{' '}
        <span style={{ color: 'lightGreen' }}>interactive</span>. Use the mouse
        wheel to zoom in a specific region. Click and hold at any point in the
        graph to drag it left or right. Hover any point in the graph to show the
        corresponding SAS and time values. Click any point in the graph to make
        the NGL viewer represent the corresponding time frame.
        <br />
        <br />
        <a
          href="/help#/help#ngl-viewer"
          target="_blank"
          rel="noreferrer noopener"
        >
          viewer
        </a>{' '}
        at the right bottom shows the trajectory. The structure is coloured
        according to residue SAS per atom values. The color scale ranges from
        white (lowest values) to red (highest values).
      </>
    ),
  },
  {
    id: 'tools',
    title: 'Tools',
  },
  {
    id: 'browser',
    header: 'Browser',
    body: (
      <>
        Browser is useful to search a specific simulation when you know what you
        are looking for
        <br />
        <br />
        Browser searches the database by any total or partial coincidence with
        the accesion number, simulation name, description, author or group
        names.
        <br />
        <br />
        In addition, internal accesions may be used to search a simulation. In
        this case the id must be whole, not partial.
      </>
    ),
    text:
      'Use the browser to search a specific simulation by its accesion number, name, description, author or group names. Any total or partial coincidence works.',
  },
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
  // The following blocks are temporal
  {
    id: 'pca-eigen-graph',
    header: 'PCA eigenvalues graph',
    body: (
      <>
        This is the eigenvalues graph.
        <br />
        <br />
        The blue bars stand for the eigenvalue, according to the left axis, and
        the explained variance, according to the right axis, of any PCA
        projection. The yellow line stands for the accounting explained
        variance, according to the right axis.
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
          viewer
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
          viewer
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
    header: 'Trajectory metadata',
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
    header: 'Trajectory chains',
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

export default documentation;
