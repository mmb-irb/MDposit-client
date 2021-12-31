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
  faTimes,
  faLock,
  faUnlock,
  faCog,
} from '@fortawesome/free-solid-svg-icons';
import {
  faDotCircle,
  faImages,
  faSquare,
} from '@fortawesome/free-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Icon } from '@material-ui/core';

// Set a simpler link component
const Link = ({ name, id, url }) => (
  <>
    <a
      href={id ? `/help#/help#${id}` : url}
      target="_blank"
      rel="noreferrer noopener"
    >
      {name}
    </a>
  </>
);

// All text to be displayed is set previously here
export const documentation = [
  {
    id: 'introduction',
    title: 'Introduction',
    body: (
      <>
        Welcome to the BioExcel-CV19 documentation page.
        <br />
        <br />
        BioExcel-CV19 is an open platform designed to provide web-access to
        molecular dynamics (MD) simulations from or related to SARS-CoV-2. The
        aim of this initiative is to ease and promote data sharing along the
        wide-world scientific community in order to contribute in the fight
        against COVID-19 disease.
        <br />
        <br />
        For any doubt please contact{' '}
        <a href="mailto:daniel.beltran@irbbarcelona.org">
          daniel.beltran@irbbarcelona.org
        </a>
      </>
    ),
    children: [
      {
        id: 'context',
        header: 'Context',
        body: (
          <>
            BioExcel-CV19 is part of the{' '}
            <Link name={'BioExcel'} url={'https://bioexcel.eu/'} /> center. The
            platform is being developed from the{' '}
            <Link
              name={'Molecular Modeling and Bioinformatics'}
              url={'http://mmb.irbbarcelona.org/www/'}
            />{' '}
            group at{' '}
            <Link
              name={'IRB Barcelona'}
              url={'https://www.irbbarcelona.org/en'}
            />{' '}
            in collaboration with the{' '}
            <Link
              name={'Barcelona Supercomputing Center'}
              url={'https://www.bsc.es/'}
            />
            . This project started as a branch of the MoDEL-CNS project, which
            was supported by the{' '}
            <Link
              name={'Human Brain Project'}
              url={'https://www.humanbrainproject.eu/en/'}
            />
            .
          </>
        ),
      },
      {
        id: 'source',
        header: 'Data source',
        body: (
          <>
            Simulations in BioExcel-CV19 proceed mostly from the{' '}
            <Link name={'MolSSI'} url={'https://covid.molssi.org/'} />{' '}
            repository. In addition, the platform contains simulations sent from
            other research groups. In case you want to share your simulations
            with BioExcel-CV19 please{' '}
            <Link
              name={'contact us'}
              url={'http://mmb.irbbarcelona.org/www/locationmap'}
            />
            .
          </>
        ),
      },
      {
        id: 'processing',
        header: 'Data processing',
        body: (
          <>
            Before a simulation is uploaded to the BioExcel-CV19 database, it is
            processed through a workflow. This workflow standarizes data format
            and then analyzes the simulation in order to upload the analysis
            results also to the database. Some important aspects of this
            processing are detailed here.
            <br />
            <br />
            <b>Interactions</b>
            <br />
            Interactions are set manually by the author or a technician. Each
            interaction is defined by a name and two "interacting agents". Each
            agent is defined by a name and an atom selection. After the
            interaction has been defined, residues in the interface are
            automatically found by using a distance cutoff of 5 Ångstroms (Å)
            for up to 100 frames along the trajectory (i.e. if two residues from
            different agents are closer than the cutoff in at least one frame
            then they both are considered interface residues). Then all
            interaction analyses are run for each of the interactions (e.g.
            hydrogen bonds).
            <br />
            <br />
            <b>Mapping</b>
            <br />
            Protein aminoacid sequences are mapped against their corresponding
            reference sequences. (e.g. spike proteins are mapped against the{' '}
            <Link
              name={'Wuhan-Hu-1/2019'}
              url={'https://www.ncbi.nlm.nih.gov/nuccore/MN908947'}
            />{' '}
            reference sequence). This allows to number residues in the structure
            according to the widely know reference numeration (which may not
            match the original topology numeration). In addition, this mapping
            allows to show residue-related bibliographic data for residues in
            the structure (e.g. epitopes).
          </>
        ),
      },
    ],
  },
  {
    id: 'features',
    title: 'Features',
    children: [
      {
        id: 'browser',
        header: 'Browser',
        body: (
          <>
            Browser is useful to search a specific simulation when you know what
            you are looking for
            <br />
            <br />
            Browser searches the database by any total or partial coincidence
            with the accesion number, simulation name, description, author or
            group names.
            <br />
            <br />
            In addition, internal accesions may be used to search a simulation.
            In this case the id must be whole, not partial.
          </>
        ),
        text:
          'Use the browser to search a specific simulation by its accesion number, name, description, author or group names. Any total or partial coincidence works.',
      },
      {
        id: 'overview',
        header: 'Overview page',
        body: (
          <>
            Data in this page is mostly provided by the simulation authors.
            Additional details about the original pdb structure are mined from
            the <Link name={'PDB web page'} url={'https://www.rcsb.org/'} />.
          </>
        ),
        page: (
          <>
            This is the overview page.
            <br />
            <br />
            Data in this page may include the name and description of the
            simulation, author and group names, type of simulation, program
            which carried the simulation and its version, original structure PDB
            data, ligand references to DrugBank and ChEMBL, contact details and
            links to the simulation sources, license and citation.
          </>
        ),
      },
      {
        id: 'trajectory',
        header: 'Trajectory page',
        body: (
          <>
            The trajectory displayed in the{' '}
            <Link name={'viewer'} id={'ngl-viewer'} /> is a subset of frames
            from the project main trajectory (25 frames by default). Loading all
            frames is not allowed for performance reasons.
            <br />
            <br />
            Predefined representation sets come from three different sources:
            <br />- Documented domains in the reference sequence (manually
            gathered from{' '}
            <Link name={'Uniprot'} url={'https://www.uniprot.org/'} />)
            <br />- Each defined interacting agent (see{' '}
            <Link name={'data processing'} id={'processing'} />)
            <br />
            - Custom sets defined by the simulation authors
            <br />
            <br />
            Some metadata values are mined from the topology and trajectory
            files while others are supplied by the authors.
            <br />
            <br />
            The protein functional analysis contains the families, domains, and
            sites, that an <Link name={'InterProScan'} id={'interpro'} />{' '}
            analysis revealed for each of the chain sequences. This is a
            prediction that might be helpful to discover functions, or to find
            similar structures for example.
          </>
        ),
        page: (
          <>
            This is the trajectory page.
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
            displays the main simulation dinamically and interactively. Use the
            mouse inside the NGL window to move, rotate or zoom the camera. You
            can get topology data of any atom by placing the mouse over it. Also
            some controls ara available under the NGL viewer in order to
            play/pause the trajectory, go fullscreen or change the viewer
            settings. Place the mouse over any button to show a summary title.
            Note that this is not the whole trajectory, but a small subset of
            frames picked along the trajectory. You can modify the number of
            frames to be loaded from the settings menu.
            <br />
            <br />
            Over the viewer there is a menu where each bubble will make the
            viewer show a predefined set of representations on click. This tool
            allows to highlight an important region in the structure (e.g. known
            domains). You may hold Control/Cmd key while clicking on a bubble in
            order to overlap up to 2 representation sets at the same time. Note
            that the overlapped set will always appear with the fill
            representation type and reduced opacity.
            <br />
            <br />
            Below the viewer there is the trajectory metadata menu. Click in the
            title to drop a table with metadata values. Hover any data field
            with the mouse to show a brief title.
            <br />
            <br />
            Below the metadata there is the protein functional analysis.
            Recognized families, domains, and sites are displayed. You can
            interact with this visualisation as such:
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
            highlighted in the viewer above. Clicking on an other entity within
            the same chain will change the highlight to that other entity.
            <br />
            <strong>Click on an empty space</strong> in this visualisation to
            remove the highlight for that chain.
            <br />
            <strong>Scroll over the visualisation</strong> to zoom in or out of
            the chain sequence. Alternatively, you can also interact with the
            top navigation part (at the top of each visualisation) to zoom in
            and out or to move within the sequence.
          </>
        ),
      },
      {
        id: 'ngl-viewer',
        header: 'NGL viewer',
        body: (
          <>
            NGL Viewer is a collection of tools for web-based molecular
            graphics.
            <br />
            <br />
            The BioExcel implementation of NGL viewer is a dynamic component
            useful to represent molecular structures and trajectories which the
            user can interact with.
            <br />
            <br />
            This component may be integrated in the web page structure (e.g. in
            the "trajectory" sheet) or an independent pop-up window which is
            draggable and resizable. To do so, hold left click in the window
            borders and drag.
            <br />
            <br />
            Use the mouse inside the NGL window to move the camera (hold right
            click), rotate the camera around its focus (hold left click) or zoom
            the camera (mouse wheel). Hover any atom with the mouse to get extra
            topology data (e.g. atom type, residue number or chain id) or left
            click on any atom to make the camera focus on it.
            <br />
            <br />
            Also some controls ara available under the NGL viewer in order to
            change other parameters:
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
            viewer pop-up window stay as it is. So when a new selection is
            requested a new NGL window is opened instead of updating the locked
            window.
            <br />
            <Icon>
              <FontAwesomeIcon icon={faStepBackward} />
            </Icon>
            {', '}
            <Icon>
              <FontAwesomeIcon icon={faStepForward} />
            </Icon>{' '}
            (Only with trajectory data) The "Previous frame" and "Next frame"
            buttons respectively are used to move through trajectory frames one
            by one.
            <br />
            <Icon>
              <FontAwesomeIcon icon={faPlay} />
            </Icon>
            {' / '}
            <Icon>
              <FontAwesomeIcon icon={faPause} />
            </Icon>{' '}
            (Only with trajectory data) The "Play / Pause" button is used to
            start or stop the trajectory animation.
            <br />
            <Icon>
              <FontAwesomeIcon icon={faExpand} />
            </Icon>
            {' / '}
            <Icon>
              <FontAwesomeIcon icon={faCompress} />
            </Icon>{' '}
            The "Enter / Exit full screen" button is used to make the NGL window
            expand to full screen or compress back to its normal size. User can
            also press "Esc" key to exit the full screen mode.
            <br />
            <Icon>
              <FontAwesomeIcon icon={faCog} />
            </Icon>{' '}
            The "Settings" button opens a new panel inside the viewer which
            allows to change the display of the viewer and the representations
            themselves. The right part of the panel includes a list with all
            current reprentations. It is allowed to change the tpye, colour and
            opaciy of each representation as well as adding new representations
            with custom atom selections. This panel includes some controls at
            the left side:
            <br />- The "Toogle spin" button{' '}
            <Icon>
              <FontAwesomeIcon icon={faSyncAlt} />
            </Icon>{' '}
            is used to make the camera slowly rotate around the y-axis.
            <br /> - The "Center focus" button{' '}
            <Icon>
              <FontAwesomeIcon icon={faDotCircle} />
            </Icon>{' '}
            is used to make the camera return to its original focus.
            <br />- (Only with trajectory data) The "Smooth interpolation"
            button{' '}
            <Icon>
              <FontAwesomeIcon icon={faImages} />
            </Icon>{' '}
            /{' '}
            <Icon>
              <FontAwesomeIcon icon={faVideo} />
            </Icon>{' '}
            is used to smooth the jump between frames by adding extra frames
            in-between where the atom positions are interpolated.
            <br />- The "Invert background color" button{' '}
            <Icon>
              <FontAwesomeIcon icon={faAdjust} />
            </Icon>{' '}
            is used to switch background color between black and white.
            <br />- The "Orthographic / Perspective" button{' '}
            <Icon>
              <FontAwesomeIcon icon={faSquare} />
            </Icon>{' '}
            /{' '}
            <Icon>
              <FontAwesomeIcon icon={faCube} />
            </Icon>{' '}
            is used to change the view mode between 2D projection (orthographic
            or isometric) and 3D projection (perspective).
            <br />
            - The "Speed" bar is used to set how fast is the trajectory
            animation.
            <br />
            - The "Frames" bar allows to set how many frames along the
            trajectory are loaded in the viewer.
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
    ],
  },

  {
    id: 'analyses',
    title: 'Analyses',
    children: [
      {
        id: 'rmsds',
        header: 'RMSds',
        body: (
          <>
            RMSds page includes both <Link name={'RMSd'} id={'rmsd'} /> and{' '}
            <Link name={'TM score'} id={'tm-score'} /> analyses together.
          </>
        ),
        page: (
          <>
            This is the RMSDs analysis.
            <br />
            <br />
            This page includes both RMSD and TM score analyses together. Each
            analysis has been run against the first frame and against the
            average structure of the whole trajectory. Use tabs above the first
            table to switch between those analyses.
            <br />
            <br />
            RMSD analyses have been run over different protein atom selections:
            all protein atoms (protein), heavy atoms (protein-h), backbone and
            protein alpha carbon (c-alpha). First table displays the mean and
            standard deviation values of each atoms selection in Ångstroms (Å).
            In addition, there is a checkbox next to each atom selection name
            which allows to hide or show data in the graph below.
            <br />
            <br />
            Graph displays the RMSD/TM score value in each frame along the
            trajectory. The horizontal axis stands for the trajectory time in
            nanoseconds. The vertical axis may stand for the RMSd in Ångstroms
            (Å) or the TM score. The graph is{' '}
            <span style={{ color: 'lightGreen' }}>interactive</span>. Use the
            mouse wheel to zoom in a specific region. Click and hold at any
            point in the graph to drag it left or right. Hover any point in the
            graph to show the corresponding RMSD/TM score and time values. Click
            any point in the graph to open a{' '}
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
            average structure of the whole trajectory. RMSd analyses have been
            run over different protein atom selections: all protein atoms
            (protein), heavy atoms (protein-h), backbone and alpha carbon
            (c-alpha). The RMSd value of the structure is stored for up to 5000
            frames along the trajectory.
            <br />
            <br />
            This analysis is powered by <Link name={'Gromacs'} id={'gromacs'} />
            .
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
            over alpha carbon atoms. The TM score value of the structure is
            stored on up to 100 frames along the trajectory.
            <br />
            <br />
            This analysis is powered by the{' '}
            <Link
              name={'tmscoring'}
              url={'https://pypi.org/project/tmscoring/'}
            />{' '}
            python module. Click{' '}
            <Link
              name={'here'}
              url={'https://zhanglab.ccmb.med.umich.edu/TM-score/'}
            />{' '}
            to learn more about TM score.
          </>
        ),
      },
      {
        id: 'rmsd-perres',
        header: 'RMSd per residue',
        body: (
          <>
            The RMSD (Root Mean Squared Deviation) per residue analysis computes
            the RMSD between each residue in its original conformation (first
            frame) and its conformations in up to 200 frames along the
            trajectory. Membrane residues are excluded from this analysis since
            they are prone to jump across boundaries thus having high RMSD
            values which are not true.
            <br />
            <br />
            This analysis is powered by <Link name={'PyTraj'} id={'pytraj'} />.
          </>
        ),
        page: (
          <>
            This is the RMSd per residue analysis.
            <br />
            <br />
            RMSd values are calculated against the trajectory first frame. First
            panel is the residue selector. Residues are divided by chains.
            Chains are delimited by their titles and residues may be expanded or
            compressed for each chain independently. Each residue is represented
            by a single letter. The 'X' letter represents non-standard residues
            (i.e. not natural aminoacids). Residues sequence is split and
            numerated every 10 resiudes. Each residue is coloured according to
            its RMSD value. The color scale ranges from white (lowest values) to
            red (highest values).
            <span style={{ color: 'lightGreen' }}> Click any residue </span> to
            display its RMSD along the trajectory and highlight its atoms on the
            NGL viewer. Multiple residues may be selected at the same time. In
            this case, each selected residue is tagged with a different color.
            <br />
            <br />
            Graph at bottom left displays the RMSD of selected residues. Y axis
            represents the RMSD value in Ångstroms (Å) while X axis represents
            the simulation time in nanoseconds (ns). The graph is{' '}
            <span style={{ color: 'lightGreen' }}>interactive</span>. Use the
            mouse wheel to zoom in a specific region. Click and hold at any
            point in the graph to drag it left or right. Hover any point in the
            graph to show the corresponding RMSD and time values. Click any
            point in the graph to make the NGL viewer represent the
            corresponding time frame.
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
        body: (
          <>
            The RMSD (Root Mean Squared Deviation) pairwise analysis computes
            RMSD between 200 pairs of frames along the trajectory. The analysis
            is done for the whole structure and for the interface residues in
            each interaction. Note that this analysis is performed only with
            alpha carbon atoms for performance reasons.
            <br />
            <br />
            This analysis is powered by <Link name={'PyTraj'} id={'pytraj'} />.
          </>
        ),
        page: (
          <>
            This is the RMSd pairwise analysis.
            <br />
            <br />
            A RMSD pairwise analysis is run for all residues (Overall), which is
            the deafult displayed analysis. However, another analysis is run for
            every defined interaction, where interface residues are considered.
            Use 'Residues selector' over the heatmap to select the analysis to
            be displayed.
            <br />
            <br />
            Heatmap represents the RMSd between each pair of frames along the
            trajectory. Both horizontal and vertical axes stand for frame
            numbers. The color stands for the RMSd value and it ranges from blue
            (low) to red (high). The legend below shows the corresponding values
            in Ångstroms (Å). The heatmap is{' '}
            <span style={{ color: 'lightGreen' }}>interactive</span>. Hover any
            cell to show a tooltip with the pair of corresponding frames and the
            RMSD value between them. Click any cell on the heatmap to open a{' '}
            <a
              href="/help#/help#ngl-viewer"
              target="_blank"
              rel="noreferrer noopener"
            >
              viewer
            </a>{' '}
            displaying both corresponding frames overlapped. The horizontal axis
            frame is coloured in red while the vertical axis frame is coloured
            in blue.
          </>
        ),
      },
      {
        id: 'rgyr',
        header: 'Radius of gyration',
        body: (
          <>
            The radius of gyration analysis computes the radius of gyration of a
            molecule and the radii of gyration about the x-, y- and z-axes, as a
            function of time. The atoms are explicitly mass weighted. This
            analysis is performed over up to 5000 frames along the trajectory.
            <br />
            <br />
            This analysis is powered by <Link name={'Gromacs'} id={'gromacs'} />
            .
          </>
        ),
        page: (
          <>
            This is the Radius of gyration (Rgyr) analysis.
            <br />
            <br />
            There are four data sets: One three-dimensional (blue) and three
            single-dimensional radius. These are RgyrX (yellow), RgyrY (green)
            and RgyrZ (red). Statistics table includes data label, mean and
            standard deviation values for the overall Rgyr and each dimension.
            Values are in Ångstroms (Å).
            <br />
            <br />
            Graph displays the 4 Rgyr dataset values for each frame along the
            trajectory. Data is displayed (more opaque lines) alongside
            corresponding mean value (light horizontal line) and mean ± 1
            standard deviation (lighter horizontal bands). The horizontal axis
            stands for the trajectory time in nanoseconds. The vertical axis
            stands for the Rgyr in Ångstroms (Å). The graph is{' '}
            <span style={{ color: 'lightGreen' }}>interactive</span>. Use the
            mouse wheel to zoom in a specific region. Click and hold at any
            point in the graph to drag it left or right. Hover any point in the
            graph to show the corresponding Rgyr and time values. Click any
            point in the graph to open a{' '}
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
        body: (
          <>
            The fluctuation analysis computes the RMSF (Root Mean Square
            Fluctuation, i.e. standard deviation) of atomic positions along the
            whole trajectory after fitting to the first frame.
            <br />
            <br />
            This analysis is powered by <Link name={'Gromacs'} id={'gromacs'} />
            .
          </>
        ),
        page: (
          <>
            This is the atoms fluctuation analysis
            <br />
            <br />
            Statistics table includes fluctuation data label, mean and standard
            deviation. Values are in Ångstroms (Å).
            <br />
            <br />
            Graph below represents the fluctuation of each atom. Data is
            displayed (more opaque lines) alongside corresponding mean value
            (light horizontal line) and mean ± 1 standard deviation (lighter
            horizontal bands). The horizontal axis stands for the atoms
            numeration. The vertical axis stands for the flucutation in
            Ångstroms (Å). The graph is{' '}
            <span style={{ color: 'lightGreen' }}>interactive</span>. Use the
            mouse wheel to zoom in a specific region. Click and hold at any
            point in the graph to drag it left or right. Click any point in the
            graph to open a{' '}
            <a
              href="/help#/help#ngl-viewer"
              target="_blank"
              rel="noreferrer noopener"
            >
              viewer
            </a>{' '}
            showing the trajectory with selected atoms and their residues
            highlighted. Multiple atoms may be selected at the same time. Hover
            any point in the graph to show the highlighted atom in the viewer if
            it is already opened. The 'Clear selection' button below removes all
            graph selections and the viewer.
          </>
        ),
      },
      {
        id: 'pca',
        header: 'PCA',
        body: (
          <>
            PCA (Principal Component Analysis) calculates and diagonalizes the
            (mass-weighted) covariance matrix from up to 2000 frames along the
            trajectory in order to obtain eigenvectors. Then the relevant
            eigenvectors (greater than 1% explained variance) are analyzed thus
            generating a projection of the trajectory 20 frames long for each
            one. Note that PCA analysis is performed only with backbone atoms
            for performance reasons.
            <br />
            <br />
            This analysis is powered by <Link name={'Gromacs'} id={'gromacs'} />
            .
          </>
        ),
        page: (
          <>
            This is the PCA analysis.
            <br />
            <br />
            The blue bars in the starting graph stand for the eigenvalue,
            according to the left axis, and the explained variance, according to
            the right axis, of any PCA projection. The yellow line stands for
            the accounting explained variance, according to the right axis.
            <br />
            <br />
            The graph is interactive. Hover any bar with the mouse to show the
            exact eigenvalue and explained variance values. Click one or more
            bars to select or deselect them. The exact eigenvalue and explained
            variance values of each selected bar will be permanently shown below
            the graph. Also, the accounting explained variance of all selected
            bars is displayed further below.
            <br />
            <br />
            In case one bar is selected then a{' '}
            <Link name={'viewer'} id={'ngl-viewer'} /> will appear with the
            corresponding pca projection trajectory or eigen vector. Use the
            mouse inside the NGL window to move, rotate or zoom the camera. You
            can get topology data of any atom by placing the mouse over it. Also
            some controls ara available under the NGL viewer in order to
            play/pause the trajectory, go fullscreen or change the viewer
            settings. Place the mouse over any button to show a summary title.
            Note that not all protein atoms are represented but only the
            backbone.
            <br />
            <br />
            In case two bars are selected then the PCA projections along the
            chosen eigenvectors are shown. The color stands for the trajectory
            time. Click any point in the graph to open a new{' '}
            <Link name={'viewer'} id={'ngl-viewer'} /> showing the selected
            frame.
            <br />
            <br />
            In case more than 2 bars are selected then just the sum of their
            explained variance is shown.
          </>
        ),
      },
      {
        id: 'sasa',
        header: 'Solvent accessible surface',
        body: (
          <>
            The Solvent Accessible Surface (SAS) analysis computes the area of
            contact between the solven and each residue for up to 200 frames
            along the trajectory. Then values are divided by the number of atoms
            on each residue in order to get the SAS per atom per residue values.
            <br />
            <br />
            This analysis is powered by <Link name={'Gromacs'} id={'gromacs'} />
            .
          </>
        ),
        page: (
          <>
            This is the Solvent accessible surface analysis.
            <br />
            <br />
            First panel is the residue selector. Residues are divided by chains.
            Chains are delimited by their titles and residues may be expanded or
            compressed for each chain independently. Each residue is represented
            by a single letter. The 'X' letter represents non-standard residues
            (i.e. not natural aminoacids). Residues sequence is split and
            numerated every 10 resiudes. Each residue is coloured according to
            its SAS per atom value. The color scale ranges from white (lowest
            values) to red (highest values).
            <span style={{ color: 'lightGreen' }}> Click any residue </span> to
            display its SAS per atom along the trajectory and highlight its
            atoms on the NGL viewer. Multiple residues may be selected at the
            same time. In this case, each selected residue is tagged with a
            different color.
            <br />
            <br />
            Graph at bottom left displays the SAS per atom of selected residues.
            Y axis represents the surface in squared Ångstroms (Å<sup>{2}</sup>)
            while X axis represents the simulation time in nanoseconds (ns). The
            graph is <span style={{ color: 'lightGreen' }}>interactive</span>.
            Use the mouse wheel to zoom in a specific region. Click and hold at
            any point in the graph to drag it left or right. Hover any point in
            the graph to show the corresponding SAS and time values. Click any
            point in the graph to make the NGL viewer represent the
            corresponding time frame.
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
            according to residue SAS per atom values. The color scale ranges
            from white (lowest values) to red (highest values).
          </>
        ),
      },
      {
        id: 'dist-perres',
        header: 'Distance per residue',
        body: (
          <>
            The distance per residue analysis computes distance between each
            pair of residues in each interaction interface for up to 200 frames
            along the trajectory. Distance average and standard deviation are
            calculated.
            <br />
            <br />
            This analysis is powered by <Link name={'PyTraj'} id={'pytraj'} />.
          </>
        ),
        page: (
          <>
            This is the Distance per residue analysis.
            <br />
            <br />
            A distance per residue analysis is run for each interaction,
            recording the mean and standard deviation of distances along the
            trajectory between each residue in each different interaction agent.
            Use this panel to select which interaction residues are displayed in
            the heatmap below. Only the interaction interface residues are shown
            by default, but also all residues may be displayed (i.e. all
            residues of each interacting agent).
            <br />
            <br />
            Heatmap represents the mean distance between the geometric center of
            selected residues from different interacting agents along the
            trajectory. Both horizontal and vertical axes stand for residue
            numbers. The color stands for the distance and it ranges from blue
            (far) to red (close). The legend below shows the corresponding
            values in Ångstroms. Use tabs over the heatmap to switch between the
            mean distance and the standard deviation. The heatmap is{' '}
            <span style={{ color: 'lightGreen' }}>interactive</span>. Hover any
            cell to show a tooltip with the pair of corresponding residues and
            the mean distance / standard deviation value between them. Click any
            cell on the heatmap to open a{' '}
            <a
              href="/help#/help#ngl-viewer"
              target="_blank"
              rel="noreferrer noopener"
            >
              viewer
            </a>{' '}
            displaying the trajectory with both corresponding residues
            highlighted.
          </>
        ),
      },
      {
        id: 'electrostatic',
        header: 'Electrostatic potencial suerface',
        body: (
          <>
            The Electrostatic potencial suerface is not an analysis but a
            representation. Interface residue from both interacting agents are
            displayed. One of them is represented as a surface which is colored
            according to the atomic charges. In case atomic charges are missing
            the color is the{' '}
            <a
              href="http://nglviewer.org/"
              target="_blank"
              rel="noreferrer noopener"
            >
              NGL
            </a>{' '}
            "electrostatic" default color scheme. The other interface is
            represented in balls+sticks and colored by elements. Both
            representation systems are switchable.
          </>
        ),
        page: (
          <>
            This is the electrostatic potencial surface representation.
            <br />
            <br />
            Use the 'Interaction' selector to change the represented interaction
            in the{' '}
            <a
              href="http://nglviewer.org/"
              target="_blank"
              rel="noreferrer noopener"
            >
              NGL viewer
            </a>{' '}
            below. By default, the interface residues from one of the
            interacting agents is represented in electrostatic surface mode and
            the interface residues from the other agent is represented in balls
            and sticks coloured by element. The rest of the structure is
            represented in low opacity grey cartoon. Both the 'surfaced' and the
            'sticked' agent names are shown next to the interaction selector.
            The representation of both agent interfaces may be switched with the
            toogle button between their names.
            <br />
            <br />
            Note that trajectory is not loaded in this context because the
            surface representation is too heavy to be updated dinamically. The
            first frame is loaded instead.
          </>
        ),
      },
      {
        id: 'hbonds',
        header: 'Hydrogen bonds',
        body: (
          <>
            Hydrogen bonds analysis computes whenever an hydrogen bond is formed
            for up to 200 frames along the trajectory. Only hydrogen bonds
            between different interacting agents are observed. An acceptor and a
            donor atom are considered to form an hydrogen bond when the distance
            between them is inferior to 3 Ångstroms and the
            'acceptor - hydrogen - donor' atoms angle is superior to 135 degrees.
            <br />
            <br />
            This analysis is powered by <Link name={'PyTraj'} id={'pytraj'} />.
          </>
        ),
        page: (
          <>
            This is the hydrogen bonds analysis.
            <br />
            <br />
            A hydrogen bonds analysis is run for each defined interaction. Use
            the 'Interaction' selector to switch between these analyses.
            <br />
            <br />
            Table below lists hydrogen bonds. First three columns display the
            first interacting agent atoms, hydrogen atoms and the second interacting
            agent atoms respectively. Interacting agent atoms are labeled with the
            format "chain : residue number (residue name) . atom name" while hydrogen atoms
            are labeled with the atom name only. Hydrogen atoms are also represented
            with a long hyphen pointing to the donor atom, which may be either the first
            or the second interacting agent atom. The fourth column represents the hydrogen
            bond status along the observed trajectory frames from the begining (left) to
            the end (right). Blue regions stand for frames where the hydrogen bond happened
            while ligth grey regions stand for frames where it did not.
            Hydrogen bonds are grouped by both acceptor and donor atoms. Note that
            some bonds may be repeated in two different groups for this reason.
            Bond groups are sorted from most to least stability in the table.
            <br />
            <br />
            You can {' '} <span style={{ color: 'lightGreen' }}>click</span>{' '} in
            the colored bar in order to open a{' '}
            <a
              href="/help#/help#ngl-viewer"
              target="_blank"
              rel="noreferrer noopener"
            >
              viewer
            </a>{' '}
            showing the trajectory with both the acceptor and the donor atoms from the
            selected bond and their residues highlighted. In addition, the distance between
            these atoms and the 'acceptor - hydrogen - donor' atoms angle are represented.
          </>
        ),
      },
      {
        id: 'energies',
        header: 'Energies',
        body: (
          <>
            Energies analysis computes the Electorstatic and Van der Waals
            forces and the sum of both values for all residues from each pair of
            interacting agents for up to 100 frames along the trajectory. Energy
            averages per residue are calculated for the overall, start and end
            of the trajectory. The start and end averages are calculated from
            the first 20% and last 20% of frames of the previous subset.
            Energies are calculated for each atom individually and then added by
            residues. In case of strong bonds (e.g. covalend bonds) between two
            interacting agents the storng bond itself will be ignored. Both
            atoms implicated in the bond will be exlucded from the analysis.
            Strong bonds are guessed by atoms distance and radius, using the{' '}
            <Link name={'VMD'} id={'vmd'} /> logic.
            <br />
            <br />
            This analysis requires atomic charges to work and thus it will not
            be run when charges are not provided by authors.
            <br />
            <br />
            This analysis is powered by <Link name={'CMIP'} id={'cmip'} />.
          </>
        ),
        page: (
          <>
            This is the energies analysis.
            <br />
            <br />
            Use the interaction selector in the top of the page to select which
            interaction energies analysis is to be displayed. The displayed
            energy values and residues in the table and graphs below correspond
            to the 'Host' when interacting with the 'Guest'. In order to switch
            which interacting agent is the Host and which is the Guest use the
            toggle button next to the interaction selector.
            <br />
            <br />
            The overall energies summatory table shows the sum of all residue
            energies together for each energy (Electrostatic, Van der Waals and
            both) and each set (overall, initial and final).
            <br />
            <br />
            Graphs represent from top to bottom the electrostatic potential, the
            Van der Waals forces and the sum of both values per each residue
            respectively. Energy averages are calculated for the overall, start
            and end of the trajectory. These averages are represented in black,
            red and blue colors respectively. Horizontal axes stand for the host
            residues. Residue numeration is according to the reference topology.
            Residues with no reference use the data source numeration and are
            marked with a '*' symbol. Vertical axes stand for the residue
            potential in kcal/mol. Strong bonds between the host and the guest
            are marked in light orange color.
            <br />
            <br />
            Graphs are <span style={{ color: 'lightGreen' }}>interactive</span>.
            Use the mouse wheel to zoom in a specific region. Click and hold at
            any point in the graph to drag it left or right. Click any point in
            the graph to open a{' '}
            <a
              href="/help#/help#ngl-viewer"
              target="_blank"
              rel="noreferrer noopener"
            >
              viewer
            </a>{' '}
            displaying the trajectory with the corresponding highlighted
            residue.
          </>
        ),
      },
      {
        id: 'pockets',
        header: 'Pockets',
        body: (
          <>
            Pockets analysis searches for cavities along the trajectory. First,
            a preliminar analysis is run in order to generate a
            three-dimensional frequency grid of 1 Ångstrom resolution. Grid
            points are considered only if they have an isovalue of 0.5 or
            greater. Then pockets are defined as groups of connected grid points
            with a minimum width of 3 points (i.e. 3 Ångstroms) in all three
            dimensions. Finally, the first 10 biggest pockets are analyzed
            individually by computing their volume for up to 100 frames along
            the trajectory. Atoms surrounding each cavitiy are also found.
            <br />
            <br />
            This analysis is powered by{' '}
            <Link name={'MDpocket'} id={'mdpocket'} />.
          </>
        ),
        page: (
          <>
            This is the pockets analysis.
            <br />
            <br />
            Only the ten biggest pockets are analyzed and shown here. Left table
            lists these pockets and their average volume along the trajectory.
            Hover any pocket row to highlight the pocket region in the viewer.
            Click any pocket checkbox to show the pocket permanently in the
            viewer and display its volume thorugh the trajectory in the graph.
            Toogle the overall pockets checkbox to show/hidde all pocket
            regions.
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
            shows the selected pockets. Pockets are labeled according to their
            table name. The represented pockets surfaces are average surfaces
            and they do not change when the time / frame in the viewer is
            modified. Pockets are colored grey by default. Hovered pocket is
            highlighted yellow and each selected pocket is colored with a unique
            color corresponding to table colors. In addition, the surface of
            atoms which form the selected pockets is also represented and it is
            coloured grey. Pocket surface atoms are always the same along the
            trajectory.
            <br />
            <br />
            Graph below displays the selected pocket volumes along the
            trajectory. Each line is colored corresponding to both table and
            viewer colors. Left axis represents the pocket volume in cubic
            Ångstroms (Å<sup>{3}</sup>). Horizontal axis represents trajectory
            frames. The graph is{' '}
            <span style={{ color: 'lightGreen' }}>interactive</span>. Click any
            point to represent the corresponding frame in the viewer.
          </>
        ),
      },
      {
        id: 'mutations',
        header: 'Mutations',
        body: (
          <>
            Entropies for each residue were obtained from the{' '}
            <a
              href="https://nextstrain.org/ncov/global"
              target="_blank"
              rel="noreferrer noopener"
            >
              Nextstrain
            </a>{' '}
            web page, which relies on the{' '}
            <a
              href="https://www.gisaid.org/"
              target="_blank"
              rel="noreferrer noopener"
            >
              GISAID
            </a>{' '}
            database. The reference sequence is{' '}
            <a
              href="https://www.ncbi.nlm.nih.gov/nuccore/MN908947"
              target="_blank"
              rel="noreferrer noopener"
            >
              Wuhan-Hu-1/2019
            </a>
            .
          </>
        ),
        page: (
          <>
            This is the mutations analysis.
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
            scale which ranges from grey (low entropy) to red (high entropy).
            Use the residue selector to highlight a specific residue and focus
            it with the camera.
          </>
        ),
      },
      {
        id: 'epitopes',
        header: 'Epitopes',
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
            . A systematic search was performed with the parameters 'Source
            Organism Taxonomy Name' equals 'SARS-CoV-2' + 'Homo sapiens' and
            'Additional Structure Keywords' contains phrase 'antibody'. Last
            search was performed on June 2021 with more than 150 results. For
            each structure, SARS-CoV-2 interface residues with the human
            antibody were captured by using a distance cutoff of 5 Ångstroms
            between atoms.
          </>
        ),
        page: (
          <>
            This is the epitopes viewer.
            <br />
            <br />
            Epitopes present in the structure are listed left. The list includes
            the PDB code of the corresponding SARS-CoV-2 + human antibody
            structure and the average Solvent Accessible Surface (SAS) of all
            epitope residues together along the trajectory for each chain.
            Epitopes can be represented in the{' '}
            <a
              href="/help#/help#ngl-viewer"
              target="_blank"
              rel="noreferrer noopener"
            >
              viewer
            </a>{' '}
            at right, over the overall structure in low opacity black color.
            Hover any epitope to display its residues in yellow color. Click on
            any epitope checkbox to display its residues in a specific color and
            also the SAS of its residues together along the trajectory in the
            graph below. Lines of each epitope are represented with a different
            color. The line of each chain is represented with a different dash
            pattern. Click anywhere on the graph to change the viewer trajectory
            frame.
            <br />
            <br />
            Several epitopes may be selected in order to compare them. Note that
            if overlapping epitopes are selected then epitopes above in the list
            will eclipse epitopes below in the viewer. Click on the overall
            pockets checkbox to represent the overall epitopes representation.
          </>
        ),
      },
    ],
  },

  {
    id: 'bibliography',
    title: 'Bibliography',
    children: [
      {
        id: 'cmip',
        header: 'CMIP',
        body: (
          <>
            Gelpí, J.L., Kalko, S.G., Barril, X., Cirera, J., de la Cruz, X.,
            Luque, F.J. and Orozco, M. (2001), Classical molecular interaction
            potentials: Improved setup procedure in molecular dynamics
            simulations of proteins. Proteins, 45: 428-437.
            https://doi.org/10.1002/prot.1159
          </>
        ),
      },
      {
        id: 'gromacs',
        header: 'Gromacs',
        body: (
          <>
            H. Bekker, H.J.C. Berendsen, E.J. Dijkstra, S. Achterop, R. van
            Drunen, D. van der Spoel, A. Sijbers, and H. Keegstra et al.,
            “Gromacs: A parallel computer for molecular dynamics simulations”;
            pp. 252–256 in Physics computing 92. Edited by R.A. de Groot and J.
            Nadrchal. World Scientific, Singapore, 1993.
            <br />
            <br />
            H.J.C. Berendsen, D. van der Spoel, and R. van Drunen, “GROMACS: A
            message-passing parallel molecular dynamics implementation,” Comp.
            Phys. Comm., 91 43–56 (1995).
            <br />
            <br />
            E. Lindahl, B. Hess, and D. van der Spoel, “GROMACS 3.0: A package
            for molecular simulation and trajectory analysis,” J. Mol. Mod., 7
            306–317 (2001).
            <br />
            <br />
            D. van der Spoel, E. Lindahl, B. Hess, G. Groenhof, A.E. Mark, and
            H.J.C. Berendsen, “GROMACS: Fast, Flexible and Free,” J. Comp.
            Chem., 26 1701–1718 (2005).
            <br />
            <br />
            B. Hess, C. Kutzner, D. van der Spoel, and E. Lindahl, “GROMACS 4:
            Algorithms for Highly Efficient, Load-Balanced, and Scalable
            Molecular Simulation,” J. Chem. Theory Comput., 4 [3] 435–447
            (2008).
            <br />
            <br />
            S. Pronk, S. Páll, R. Schulz, P. Larsson, P. Bjelkmar, R. Apostolov,
            M.R. Shirts, and J.C. Smith et al., “GROMACS 4.5: A high-throughput
            and highly parallel open source molecular simulation toolkit,”
            Bioinformatics, 29 [7] 845–854 (2013).
            <br />
            <br />
            S. Páll, M.J. Abraham, C. Kutzner, B. Hess, and E. Lindahl,
            “Tackling exascale software challenges in molecular dynamics
            simulations with GROMACS”; pp. 3–27 in Solving software challenges
            for exascale. Edited by S. Markidis and E. Laure. Springer
            International Publishing Switzerland, London, 2015.
            <br />
            <br />
            M.J. Abraham, T. Murtola, R. Schulz, S. Páll, J.C. Smith, B. Hess,
            and E. Lindahl, “GROMACS: High performance molecular simulations
            through multi-level parallelism from laptops to supercomputers,”
            SoftwareX, 1–2 19–25 (2015).
          </>
        ),
      },
      {
        id: 'interpro',
        header: 'InterPro',
        body: (
          <>
            Blum M, Chang H, Chuguransky S, Grego T, Kandasaamy S, Mitchell A,
            Nuka G, Paysan-Lafosse T, Qureshi M, Raj S, RichardsonL, Salazar GA,
            Williams L, Bork P, Bridge A, Gough J, Haft DH, Letunic I,
            Marchler-Bauer A, Mi H, Natale DA, Necci M, Orengo CA, Pandurangan
            AP, Rivoire C, Sigrist CJA, Sillitoe I, Thanki N, Thomas PD, Tosatto
            SCE, Wu CH, Bateman A and Finn RD The InterPro protein families and
            domains database: 20 years on. Nucleic Acids Research, Nov 2020,
            (doi: 10.1093/nar/gkaa977)
          </>
        ),
      },
      {
        id: 'mdpocket',
        header: 'MDpocket',
        body: (
          <>
            Peter Schmidtke, Axel Bidon-Chanal, F. Javier Luque, Xavier Barril,
            MDpocket: open-source cavity detection and characterization on
            molecular dynamics trajectories, Bioinformatics, Volume 27, Issue
            23, 1 December 2011, Pages 3276–3285,
            https://doi.org/10.1093/bioinformatics/btr550
          </>
        ),
      },
      {
        id: 'pytraj',
        header: 'PyTraj',
        body: (
          <>
            Software for Processing and Analysis of Molecular Dynamics
            Trajectory Data. Daniel R. Roe and Thomas E. Cheatham, III. Journal
            of Chemical Theory and Computation 2013 9 (7), 3084-3095
          </>
        ),
      },
      {
        id: 'vmd',
        header: 'VMD',
        body: (
          <>
            Humphrey, W., Dalke, A. and Schulten, K., "VMD - Visual Molecular
            Dynamics", J. Molec. Graphics, 1996, vol. 14, pp. 33-38.
          </>
        ),
      },
    ],
  },
];

// Get all blocks, including parent and children documentation blocks, in a single array
export const docs = documentation.reduce((previous, current) => {
  previous.push(current);
  current.children && current.children.forEach(child => previous.push(child));
  return previous;
}, []);
