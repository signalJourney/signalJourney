# Research: Common Pipeline Parameters & Metrics

This document outlines common parameters, functions, and quality metrics used in standard EEG/MEG processing pipelines across popular toolboxes (EEGLAB, MNE-Python, FieldTrip). This research informs the creation of example `signalJourney.json` files (Task 4).

*(Note: This is a starting point and requires further detailed research for specific function calls and parameter values.)*

## 1. Basic Preprocessing

**Goal:** Initial cleaning (filtering, referencing, basic artifact handling).

**Common Steps:**

*   **Loading Data:** Reading raw data formats (e.g., EDF, FIF, SET).
*   **Filtering:**
    *   High-pass (e.g., 0.5 Hz, 1 Hz)
    *   Low-pass (e.g., 40 Hz, 45 Hz, 100 Hz)
    *   Notch (e.g., 50 Hz or 60 Hz line noise)
*   **Referencing:** Applying a new reference (e.g., Average, Mastoids, Linked-Mastoids).
*   **(Optional) Downsampling:** Reducing sampling rate.
*   **(Optional) Bad Channel Detection/Interpolation:** Identifying and handling faulty channels.
*   **(Optional) Basic Artifact Rejection:** Simple thresholding or visual inspection.

**Toolbox Examples (Conceptual):**

*   **EEGLAB:** `pop_loadset()`, `pop_eegfiltnew()`, `pop_reref()`, `pop_resample()`, `pop_rejchan()`, `pop_rejcont()`
*   **MNE-Python:** `mne.io.read_raw_*()`, `raw.filter()`, `raw.set_eeg_reference()`, `raw.resample()`, `raw.interpolate_bads()`, `mne.preprocessing.find_bad_channels_maxwell()`
*   **FieldTrip:** `ft_preprocessing()` (with various cfg options for filtering, referencing, resampling), `ft_rejectartifact()`

**Common Parameters:**

*   Filter type (FIR, IIR), order, cutoff frequencies.
*   Reference channel(s).
*   New sampling rate.
*   Bad channel detection thresholds/methods.
*   Artifact rejection thresholds.

**Quality Metrics:**

*   Number/percentage of bad channels interpolated.
*   Number/percentage of segments rejected (if applicable).
*   Power Spectral Density (PSD) before/after filtering.

**Toolbox Examples (Specific):**

*   **EEGLAB:**
    *   `EEG = pop_loadset('filename', 'your_data.set');`
    *   `EEG = pop_eegfiltnew(EEG, 'locutoff', 1, 'hicutoff', 40);` % Band-pass
    *   `EEG = pop_eegfiltnew(EEG, 'locutoff', 58, 'hicutoff', 62, 'revfilt', 1);` % Notch filter
    *   `EEG = pop_reref( EEG, [65 66] );` % Re-reference to channels 65, 66 (e.g., Mastoids)
    *   `EEG = pop_resample( EEG, 250);` % Downsample to 250 Hz
    *   `EEG = pop_rejchan(EEG, 'elec',[1:64] ,'threshold',5,'norm','on','measure','kurt');` % Detect bad channels by kurtosis
    *   `EEG = pop_interp(EEG, EEG.reject.indelec, 'spherical');` % Interpolate bad channels
*   **MNE-Python:**
    *   `raw = mne.io.read_raw_fif('your_data_raw.fif', preload=True)`
    *   `raw.filter(l_freq=1.0, h_freq=40.0, fir_design='firwin')`
    *   `raw.notch_filter(freqs=60, fir_design='firwin')`
    *   `raw.set_eeg_reference(ref_channels=['M1', 'M2'])` % Or 'average'
    *   `raw.resample(sfreq=250, npad='auto')`
    *   `raw.info['bads'] = ['EEG 053']` % Manually mark bad channel
    *   `raw.interpolate_bads(reset_bads=True)`
*   **FieldTrip:**
    *   `cfg = []; cfg.dataset = 'your_data.ds'; data_raw = ft_preprocessing(cfg);`
    *   `cfg = []; cfg.hpfilter = 'yes'; cfg.hpfreq = 1; cfg.lpfilter = 'yes'; cfg.lpfreq = 40; data_filt = ft_preprocessing(cfg, data_raw);`
    *   `cfg = []; cfg.bsfilter = 'yes'; cfg.bsfreq = [58 62]; data_notch = ft_preprocessing(cfg, data_filt);`
    *   `cfg = []; cfg.reref = 'yes'; cfg.refchannel = {'REF1', 'REF2'}; data_reref = ft_preprocessing(cfg, data_notch);` % REF1/2 are e.g., mastoid channels
    *   `cfg = []; cfg.resamplefs = 250; data_resampled = ft_resampledata(cfg, data_reref);`
    *   `cfg = []; cfg.method = 'summary'; cfg.metric = 'zvalue'; data_clean = ft_rejectvisual(cfg, data_resampled);` % Visual inspection/summary for bad channels/trials

**Common Parameters:**

*   Filter: Cutoff frequencies (`locutoff`/`hicutoff`, `l_freq`/`h_freq`, `hpfreq`/`lpfreq`), filter type (`fir_design`, filter order), notch frequencies (`bsfreq`).
*   Reference: Reference channel names/indices (`refchannel`, `ref_channels`), or 'average'.
*   Sampling: New sampling rate (`sfreq`, `resamplefs`).
*   Bad Channels: Detection method/thresholds (`measure`, `threshold`), interpolation method (`spherical`, `reset_bads`).

## 2. ICA Decomposition & Cleaning

**Goal:** Identify and remove artifactual components (blinks, muscle, heartbeats).

**Common Steps:**

*   **Preprocessing:** Typically includes high-pass filtering (e.g., 1 Hz) and potentially bad channel removal.
*   **Run ICA:** Applying an ICA algorithm (e.g., runica, infomax, fastica, picard).
*   **Component Classification:** Identifying artifactual components (manually or using automated classifiers like ICLabel, SASICA).
*   **Component Removal:** Subtracting artifactual components from the data.

**Toolbox Examples (Conceptual):**

*   **EEGLAB:** `pop_runica()`, `pop_iclabel()`, `pop_subcomp()`
*   **MNE-Python:** `mne.preprocessing.ICA()`, `ica.fit()`, `ica.find_bads_eog()`, `ica.find_bads_ecg()`, `ica.apply()`
*   **FieldTrip:** `ft_componentanalysis()` (with cfg.method = 'runica'), component selection often manual or via external scripts, `ft_rejectcomponent()`

**Common Parameters:**

*   ICA algorithm choice.
*   Number of components (or rank estimation).
*   Component classification thresholds/method.
*   Indices of components to remove.

**Quality Metrics:**

*   Number/percentage of components removed.
*   Variance explained by removed components.
*   Comparison of data before/after component removal (e.g., PSD, ERPs).
*   ICLabel classification probabilities (if used).

**Toolbox Examples (Specific):**

*   **EEGLAB:**
    *   `EEG = pop_runica(EEG, 'icatype', 'runica', 'extended',1,'interrupt','on');`
    *   `EEG = iclabel(EEG);` % Run ICLabel classifier
    *   `EEG = pop_icflag(EEG, [NaN NaN;0.8 1;0.8 1;NaN NaN;NaN NaN;NaN NaN;NaN NaN]);` % Flag components based on ICLabel thresholds (example: Muscle & Eye > 80%)
    *   `EEG = pop_subcomp( EEG, find(EEG.reject.gcompreject), 0);` % Remove flagged components
*   **MNE-Python:**
    *   `ica = mne.preprocessing.ICA(n_components=15, method='fastica', random_state=97, max_iter='auto')`
    *   `ica.fit(raw_filt, picks='eeg')` % Fit on filtered data
    *   `eog_indices, eog_scores = ica.find_bads_eog(raw, ch_name='EOG061')` % Find EOG components
    *   `ica.exclude = eog_indices` % Mark components for exclusion
    *   `ica.apply(raw)` % Apply ICA to remove components
*   **FieldTrip:**
    *   `cfg = []; cfg.method = 'runica'; comp = ft_componentanalysis(cfg, data_clean);`
    *   % Manual component selection usually follows (visual inspection of topography, time course)
    *   `cfg = []; cfg.component = [3 5 12]; data_postica = ft_rejectcomponent(cfg, comp, data_clean);` % Remove components 3, 5, 12 (example)

**Common Parameters:**

*   ICA algorithm (`icatype`, `method`).
*   Number of components (`n_components`) or data rank.
*   Component classification method (ICLabel thresholds, `find_bads_eog`, manual selection).
*   Indices of components to remove (`component`, `ica.exclude`).

## 3. Time-Frequency Analysis

**Goal:** Analyze spectral power/phase over time.

**Common Steps:**

*   **Preprocessing:** As needed (filtering, artifact removal).
*   **Time-Frequency Decomposition:** Applying methods like Morlet wavelets, multitaper FFT, Hilbert transform.
*   **(Optional) Baseline Correction:** Subtracting/dividing by baseline period activity.
*   **(Optional) Statistical Analysis:** Comparing conditions.

**Toolbox Examples (Conceptual):**

*   **EEGLAB:** `pop_newtimef()`
*   **MNE-Python:** `mne.time_frequency.tfr_morlet()`, `mne.time_frequency.tfr_multitaper()`, `mne.time_frequency.tfr_stockwell()`
*   **FieldTrip:** `ft_freqanalysis()` (with cfg.method = 'mtmconvol', 'wavelet', 'tfr')

**Common Parameters:**

*   Frequency range and resolution.
*   Time window(s).
*   Method parameters (e.g., number of wavelet cycles, multitaper smoothing).
*   Baseline period.
*   Statistical correction method.

**Quality Metrics:**

*   Signal-to-Noise Ratio (SNR) of evoked power.
*   Statistical significance values (p-values).

**Toolbox Examples (Specific):**

*   **EEGLAB:**
    *   `[ersp,itc,powbase,times,freqs] = pop_newtimef( EEG, 1, 1, [-1000  2000], [3         0.5] , 'topovec', 1, 'elocs', EEG.chanlocs, 'chaninfo', EEG.chaninfo, 'baseline',[-500 0], 'freqs', [2 40], 'plotphase', 'off', 'plotersp', 'off', 'plotitc', 'off');` % Wavelet analysis on channel 1, baseline [-500 0]ms
*   **MNE-Python:**
    *   `freqs = np.arange(2., 40., 1.)` % Frequencies of interest
    *   `n_cycles = freqs / 2.` % Number of cycles in Morlet wavelets
    *   `power = mne.time_frequency.tfr_morlet(epochs['ConditionA'], freqs=freqs, n_cycles=n_cycles, use_fft=True, return_itc=False, decim=3, n_jobs=1)` % Calculate power for epochs
    *   `power.apply_baseline(baseline=(-0.5, 0), mode='logratio')` % Baseline correction
*   **FieldTrip:**
    *   `cfg = []; cfg.method = 'mtmconvol'; cfg.taper = 'hanning'; cfg.foi = 2:1:40;` % Frequencies 2 to 40 Hz
    *   `cfg.t_ftimwin = ones(length(cfg.foi),1).*0.5;`   % Time window 500ms
    *   `cfg.toi = -1:0.05:2;` % Time points -1 to 2 sec, 50ms steps
    *   `freq = ft_freqanalysis(cfg, data_epoched);`
    *   `cfg = []; cfg.baseline = [-0.5 0]; cfg.baselinetype = 'relative'; freq_bl = ft_freqbaseline(cfg, freq);`

**Common Parameters:**

*   Frequencies (`freqs`, `foi`).
*   Time window/points of interest (`times`, `toi`).
*   Method (`mtmconvol`, `wavelet`, `tfr_morlet`).
*   Method-specific parameters: cycles (`n_cycles`), taper (`taper`), time-window (`t_ftimwin`).
*   Baseline period (`baseline`, `cfg.baseline`), baseline type (`mode`, `baselinetype`).

## 4. Source Localization

**Goal:** Estimate the location of neural activity within the brain.

**Common Steps:**

*   **Preprocessing:** Thorough cleaning often required.
*   **Forward Modeling:** Creating a head model (BEM, FEM, spherical) and leadfield matrix based on sensor locations and head geometry.
*   **Covariance Estimation:** Calculating data covariance matrix.
*   **Inverse Solution:** Applying an inverse method (e.g., MNE, dSPM, sLORETA, LCMV Beamformer).
*   **(Optional) Morphing to Template:** Transforming source estimates to a standard brain space (e.g., MNI, fsaverage).

**Toolbox Examples (Conceptual):**

*   **EEGLAB (via plugins like FieldTrip or custom scripts):** `pop_dipfit_settings()`, `pop_dipfit_selectcomps()` (for component dipoles)
*   **MNE-Python:** `mne.make_bem_model()`, `mne.make_bem_solution()`, `mne.setup_source_space()`, `mne.make_forward_solution()`, `mne.compute_covariance()`, `mne.minimum_norm.make_inverse_operator()`, `mne.minimum_norm.apply_inverse()`, `mne.beamformer.make_lcmv()`, `mne.beamformer.apply_lcmv()`
*   **FieldTrip:** `ft_prepare_headmodel()`, `ft_prepare_leadfield()`, `ft_timelockanalysis()` (for covariance), `ft_sourceanalysis()` (with various cfg.method options)

**Common Parameters:**

*   Head model type and parameters (conductivity).
*   Source space definition (surface/volume, resolution).
*   Inverse method choice and regularization parameters (e.g., SNR, lambda2).
*   Covariance estimation parameters (time window, baseline).

**Quality Metrics:**

*   Goodness of Fit (GoF) for dipole fitting.
*   Explained variance.
*   Resolution metrics (e.g., Point Spread Function).
*   Cross-validation results.

**Toolbox Examples (Specific):**

*   **EEGLAB (Dipfit Plugin):**
    *   `EEG = pop_dipfit_settings( EEG, 'hdmfile','standard_BEM.mat','coordformat','MNI', ...);` % Set head model
    *   `EEG = pop_multifit( EEG, [1:15] , 'threshold', 100);` % Fit dipoles to ICA components 1-15
    *   `EEG = pop_dipfit_select( EEG, 'percent', 15 );` % Select dipoles with residual variance < 15%
*   **MNE-Python:**
    *   `subjects_dir = mne.datasets.fetch_fsaverage()`
    *   `src = mne.setup_source_space(subject='fsaverage', spacing='oct6', subjects_dir=subjects_dir, add_dist=False)` % Setup source space
    *   `conductivity = (0.3,)` # for single layer BEM
    *   `model = mne.make_bem_model(subject='fsaverage', ico=4, conductivity=conductivity, subjects_dir=subjects_dir)`
    *   `bem_sol = mne.make_bem_solution(model)`
    *   `fwd = mne.make_forward_solution(epochs.info, trans='fsaverage', src=src, bem=bem_sol, meg=False, eeg=True, mindist=5.0)`
    *   `cov = mne.compute_covariance(epochs, tmax=0., method=['shrunk', 'empirical'])` % Compute covariance from baseline
    *   `inverse_operator = make_inverse_operator(epochs.info, fwd, cov, loose=0.2, depth=0.8)`
    *   `method = "dSPM"`
    *   `snr = 3.0`
    *   `lambda2 = 1.0 / snr ** 2`
    *   `stc = apply_inverse(evoked, inverse_operator, lambda2, method=method, pick_ori=None)` % Apply dSPM
*   **FieldTrip:**
    *   `cfg = []; cfg.method = 'standard_bem'; headmodel = ft_prepare_headmodel(cfg, segmented_mri);` % Create BEM head model
    *   `cfg = []; cfg.grid.resolution = 10; cfg.headmodel = headmodel; leadfield = ft_prepare_leadfield(cfg, data_avg);` % Create leadfield grid
    *   `cfg = []; cfg.method = 'lcmv'; cfg.headmodel = headmodel; cfg.grid = leadfield; cfg.lcmv.lambda = '5%'; source = ft_sourceanalysis(cfg, data_avg);` % LCMV beamformer

**Common Parameters:**

*   Head model file/type (`hdmfile`, `method='standard_bem'`, `make_bem_model`).
*   Source space definition (`spacing`, `grid.resolution`).
*   Inverse method (`method='dSPM'`, `method='lcmv'`).
*   Regularization (`lambda2`, `lcmv.lambda`).
*   Covariance matrix calculation parameters (`tmax`, time window).

## 5. Connectivity Analysis

**Goal:** Measure statistical dependencies between signals from different sensors or sources.

**Common Steps:**

*   **Preprocessing:** Careful cleaning is crucial.
*   **Connectivity Measure Calculation:** Applying measures like Coherence, Phase Locking Value (PLV), Phase Lag Index (PLI/wPLI), Granger Causality.
*   **(Optional) Source Reconstruction:** Applying connectivity analysis in source space.
*   **Statistical Assessment:** Comparing conditions, correcting for multiple comparisons.

**Toolbox Examples (Conceptual):**

*   **EEGLAB (via plugins like SIFT, BCILAB or custom scripts):** Various toolboxes available.
*   **MNE-Python:** `mne_connectivity.spectral_connectivity_epochs()`, `mne_connectivity.phase_amplitude_coupling()`
*   **FieldTrip:** `ft_connectivityanalysis()` (with various cfg.method options)

**Common Parameters:**

*   Connectivity measure choice.
*   Frequency bands of interest.
*   Time windows.
*   Statistical thresholding/correction methods.
*   Model order (for Granger causality).

**Quality Metrics:**

*   Statistical significance values.
*   Comparison to surrogate data.
*   Consistency across time/frequency.

**Toolbox Examples (Specific):**

*   **EEGLAB (SIFT Plugin/Custom Scripts):**
    *   % (Requires specific toolboxes like SIFT) Example concepts:
    *   `EEG = pop_est_sourcemodel(EEG, 'model','AR', 'order', 5);` % Estimate VAR model
    *   `EEG = pop_est_connectivity(EEG, 'connmethods', {'dDTF'});` % Calculate directed Transfer Function
*   **MNE-Python (mne-connectivity):**
    *   `con = mne_connectivity.spectral_connectivity_epochs(epochs['ConditionA'], method='coh', mode='multitaper', sfreq=epochs.info['sfreq'], fmin=8., fmax=13., faverage=True, mt_adaptive=True, n_jobs=1)` % Calculate coherence in alpha band
    *   `con_pli = mne_connectivity.spectral_connectivity_epochs(epochs['ConditionB'], method='pli', sfreq=epochs.info['sfreq'], fmin=4., fmax=8.)` % Calculate PLI in theta band
*   **FieldTrip:**
    *   `cfg = []; cfg.method = 'coh'; cfg.complex = 'complex'; freq_coh = ft_connectivityanalysis(cfg, freq);` % Calculate coherence
    *   `cfg = []; cfg.method = 'plv'; freq_plv = ft_connectivityanalysis(cfg, freq);` % Calculate Phase Locking Value

**Common Parameters:**

*   Connectivity measure (`connmethods`, `method` in `spectral_connectivity_epochs`, `cfg.method`).
*   Frequency range (`fmin`, `fmax`, `foi`).
*   Mode/tapering (`mode`, `mt_adaptive`, `cfg.taper`).
*   Model order (for VAR/Granger).

**Quality Metrics:**

*   Statistical significance values (p-values, often from permutation tests).
*   Comparison to surrogate data (e.g., phase-randomized).
*   Consistency across time/frequency/subjects.

*(Note: Parameter values are illustrative and should be chosen based on specific experimental design and data characteristics.)* 