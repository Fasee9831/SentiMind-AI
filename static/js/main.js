document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // Automatic Subtitle Reveal Controller
    // ==========================================
    const heroSubtitle = document.getElementById('heroSubtitle');

    function initHeroSubtitle() {
        if (!heroSubtitle) return;
        const textContent = heroSubtitle.textContent.trim() || 
            "Instantly analyze text documents, spreadsheets, customer feedback, and files to understand tone, sentiment, and key insights.";
        const words = textContent.split(/\s+/);
        heroSubtitle.innerHTML = '';
        words.forEach((w, idx) => {
            const span = document.createElement('span');
            span.className = 'reveal-word';
            span.style.setProperty('--word-i', idx);
            span.textContent = w;
            heroSubtitle.appendChild(span);
            if (idx < words.length - 1) {
                heroSubtitle.appendChild(document.createTextNode(' '));
            }
        });
    }

    function playSubtitleReveal() {
        if (!heroSubtitle) return;
        heroSubtitle.classList.remove('is-revealed');
        void heroSubtitle.offsetWidth; // Force reflow to cleanly trigger CSS animation
        heroSubtitle.classList.add('is-revealed');
    }

    // Split words on initial script run
    initHeroSubtitle();

    // ==========================================
    // SentiMind.ai Cinema Robot Preloader Controller
    // ==========================================
    function initStartupPreloader() {
        const preloader = document.getElementById('startupPreloader');
        const video = document.getElementById('preloaderVideo');
        const fallback = document.getElementById('preloaderFallback');
        const audioBtn = document.getElementById('preloaderAudioToggle');
        const audioLabel = document.getElementById('preloaderAudioLabel');
        const skipBtn = document.getElementById('preloaderSkipBtn');
        const statusText = document.getElementById('preloaderStatusText');

        if (!preloader) {
            playSubtitleReveal();
            return;
        }

        let isExiting = false;
        const progressFill = document.getElementById('preloaderProgressFill');

        // Only skip intro if explicitly requested in URL query (?skip_intro=1)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('skip_intro') === '1' && !window.__isManualReplay) {
            exitPreloader(true);
            return;
        }

        function updateAudioUI(active) {
            if (audioBtn) {
                audioBtn.classList.toggle('is-active', active);
                audioBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
            }
            if (audioLabel) {
                audioLabel.textContent = active ? 'Sound On' : 'Tap for Sound';
            }
        }

        function exitPreloader(immediate = false) {
            if (isExiting) return;
            isExiting = true;
            window.__isManualReplay = false;

            if (immediate) {
                if (video) {
                    try { video.pause(); } catch (e) {}
                }
                document.body.classList.remove('preloader-active');
                document.body.classList.add('app-revealed');
                preloader.classList.add('preloader-exit', 'preloader-hidden');
                playSubtitleReveal();
                return;
            }

            // Smooth audio fade out if unmuted
            if (video && !video.muted && video.volume > 0) {
                let vol = video.volume;
                const fadeInterval = setInterval(() => {
                    vol = Math.max(0, vol - 0.2);
                    try { video.volume = vol; } catch (e) {}
                    if (vol <= 0) {
                        clearInterval(fadeInterval);
                    }
                }, 30);
            }

            // Tactile visual feedback on skip button
            if (skipBtn) {
                skipBtn.classList.add('is-skipping');
                const btnText = skipBtn.querySelector('.pill-btn-text');
                if (btnText) btnText.textContent = 'Entering…';
            }

            // Begin cinematic dissolve of preloader
            preloader.classList.add('preloader-exit');

            // Trigger orchestrated staggered reveal of dashboard elements
            requestAnimationFrame(() => {
                document.body.classList.remove('preloader-active');
                document.body.classList.add('app-revealed');
            });

            // Cascade typewriter reveal right as the hero title glides into place
            setTimeout(() => {
                playSubtitleReveal();
            }, 260);

            // Cleanly remove preloader from paint tree after dissolve finishes
            setTimeout(() => {
                if (video) {
                    try { video.pause(); } catch (e) {}
                }
                preloader.classList.add('preloader-hidden');
            }, 580);
        }

        // Skip button handler
        if (skipBtn) {
            skipBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                exitPreloader(false);
            });
        }

        // Audio toggle handler (toggles sound without interrupting playback)
        if (audioBtn && video) {
            audioBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (video.muted) {
                    video.muted = false;
                    updateAudioUI(true);
                } else {
                    video.muted = true;
                    updateAudioUI(false);
                }
            });
        }

        // Tap/click anywhere on preloader screen to skip instantly
        preloader.addEventListener('click', (e) => {
            if (e.target.closest('#preloaderAudioToggle')) return;
            exitPreloader(false);
        });

        // Keyboard navigation: Escape, Space, or Enter immediately enters dashboard
        const handleKeydown = (e) => {
            if (['Escape', ' ', 'Enter'].includes(e.key) && !isExiting) {
                e.preventDefault();
                window.removeEventListener('keydown', handleKeydown);
                exitPreloader(false);
            }
        };
        window.addEventListener('keydown', handleKeydown);

        // Respect prefers-reduced-motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            exitPreloader(true);
            return;
        }

        if (video) {
            // Seamless ending right as video approaches its natural completion
            video.addEventListener('timeupdate', () => {
                if (!isExiting && video.duration) {
                    if (video.currentTime >= Math.max(video.duration - 0.25, 1)) {
                        exitPreloader(false);
                    }
                }
            });

            // Natural video completion
            video.addEventListener('ended', () => {
                exitPreloader(false);
            });

            // Graceful error fallback
            video.addEventListener('error', () => {
                console.warn('Preloader video error, falling back.');
                if (fallback) fallback.style.display = 'flex';
                video.style.display = 'none';
                setTimeout(() => exitPreloader(false), 2000);
            });

            // Native muted playback starts cleanly as soon as video metadata and frames are available
            video.muted = true;
            updateAudioUI(false);

            const startPlay = () => {
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch((err) => {
                        console.log('Video autoplay deferred by browser, resuming on interaction:', err);
                        const resumeOnInteract = () => {
                            video.play().catch(() => {});
                        };
                        window.addEventListener('touchstart', resumeOnInteract, { once: true });
                        window.addEventListener('click', resumeOnInteract, { once: true });
                    });
                }
            };

            if (video.readyState >= 2) {
                startPlay();
            } else {
                video.addEventListener('loadedmetadata', startPlay, { once: true });
                video.addEventListener('canplay', startPlay, { once: true });
            }
        } else {
            setTimeout(() => exitPreloader(false), 2000);
        }

        // Safety timeout: 35s to allow full video playthrough without cutting off
        setTimeout(() => {
            if (!isExiting) {
                exitPreloader(false);
            }
        }, 35000);
    }

    // Run Preloader on initial startup
    initStartupPreloader();

    // Global helper to replay preloader anytime from console or button
    window.replayPreloader = function() {
        window.__isManualReplay = true;
        const preloader = document.getElementById('startupPreloader');
        const video = document.getElementById('preloaderVideo');
        const skipBtn = document.getElementById('preloaderSkipBtn');
        if (skipBtn) {
            skipBtn.classList.remove('is-skipping');
            const btnText = skipBtn.querySelector('.pill-btn-text');
            if (btnText) btnText.textContent = 'Skip Intro';
        }
        document.body.classList.remove('app-revealed');
        document.body.classList.add('preloader-active');
        if (heroSubtitle) heroSubtitle.classList.remove('is-revealed');
        if (preloader) {
            preloader.classList.remove('preloader-hidden', 'preloader-exit');
            if (video) {
                video.currentTime = 0;
                video.volume = 1;
                video.muted = false;
            }
            initStartupPreloader();
        } else {
            document.body.classList.remove('preloader-active');
            document.body.classList.add('app-revealed');
            playSubtitleReveal();
        }
    };

    // Nav bar replay intro button hookup
    const replayIntroBtn = document.getElementById('replayIntroBtn');
    if (replayIntroBtn) {
        replayIntroBtn.addEventListener('click', () => {
            window.replayPreloader();
        });
    }

    // Ensure reveal animation plays whenever returning to or displaying the page
    window.addEventListener('pageshow', () => {
        const preloader = document.getElementById('startupPreloader');
        if (!preloader || preloader.classList.contains('preloader-hidden') || preloader.classList.contains('preloader-exit')) {
            playSubtitleReveal();
        }
    });

    // Mode Switcher Elements
    const tabDirectText = document.getElementById('tabDirectText');
    const tabDocUpload = document.getElementById('tabDocUpload');
    const directTextSection = document.getElementById('directTextSection');
    const docUploadSection = document.getElementById('docUploadSection');

    // Direct Text Elements
    const sentimentForm = document.getElementById('sentimentForm');
    const textInput = document.getElementById('textInput');
    const charCounter = document.getElementById('charCounter');
    const wordCounter = document.getElementById('wordCounter');
    const clearTextBtn = document.getElementById('clearTextBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const sampleChips = document.querySelectorAll('.sample-chip');

    // Document Upload Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const extractLoader = document.getElementById('extractLoader');
    const extractLoaderSubtext = document.getElementById('extractLoaderSubtext');
    const documentInfoCard = document.getElementById('documentInfoCard');
    const docTypeBadge = document.getElementById('docTypeBadge');
    const docFilename = document.getElementById('docFilename');
    const docSizeTag = document.getElementById('docSizeTag');
    const docUnitsTag = document.getElementById('docUnitsTag');
    const docWordsTag = document.getElementById('docWordsTag');
    const docBatchTag = document.getElementById('docBatchTag');
    const removeDocBtn = document.getElementById('removeDocBtn');
    
    // Column Selector Elements
    const columnSelectRow = document.getElementById('columnSelectRow');
    const columnSelect = document.getElementById('columnSelect');
    const colDetectedHint = document.getElementById('colDetectedHint');
    const columnPills = document.getElementById('columnPills');
    const columnWarningAlert = document.getElementById('columnWarningAlert');
    const columnWarningText = document.getElementById('columnWarningText');

    const extractedTextarea = document.getElementById('extractedTextarea');
    const togglePreviewBtn = document.getElementById('togglePreviewBtn');
    const analyzeDocBtn = document.getElementById('analyzeDocBtn');
    const analyzeDocBtnText = document.getElementById('analyzeDocBtnText');

    // Result Panel View Elements
    const resultsEmptyState = document.getElementById('resultsEmptyState');
    const resultsLoader = document.getElementById('resultsLoader');
    const resultsContent = document.getElementById('resultsContent');

    // Results Header & Banner
    const resultDocBanner = document.getElementById('resultDocBanner');
    const bannerDocName = document.getElementById('bannerDocName');
    const resultsTitle = document.getElementById('resultsTitle');
    const resultsSubtitle = document.getElementById('resultsSubtitle');
    const sentimentBadge = document.getElementById('sentimentBadge');
    const sentimentText = document.getElementById('sentimentText');
    const compoundValue = document.getElementById('compoundValue');
    const meterPointer = document.getElementById('meterPointer');
    const moodReactionOrb = document.getElementById('moodReactionOrb');
    const moodReactionEmoji = document.getElementById('moodReactionEmoji');
    const soundwaveEqualizer = document.getElementById('soundwaveEqualizer');
    const moodPercentageText = document.getElementById('moodPercentageText');
    const meterGlowFill = document.getElementById('meterGlowFill');
    const emotionScanSection = document.getElementById('emotionScanSection');
    const emotionScanContent = document.getElementById('emotionScanContent');

    // Suggested Improvements Elements & State
    const suggestedImprovementsBtn = document.getElementById('suggestedImprovementsBtn');
    const improvementsModal = document.getElementById('improvementsModal');
    const closeImprovementsModalBtn = document.getElementById('closeImprovementsModalBtn');
    const dismissImprovementsBtn = document.getElementById('dismissImprovementsBtn');
    const copyImprovementsBtn = document.getElementById('copyImprovementsBtn');
    const copyImprovementsBtnText = document.getElementById('copyImprovementsBtnText');
    const improvementsSentimentBadge = document.getElementById('improvementsSentimentBadge');
    const improvementsConfidenceText = document.getElementById('improvementsConfidenceText');
    const improvementsRationaleMsg = document.getElementById('improvementsRationaleMsg');
    const improvementsCardsList = document.getElementById('improvementsCardsList');

    let currentAnalysisData = null;
    let currentAnalysisImprovements = [];

    // Batch Reviews KPI Elements
    const batchKpiContainer = document.getElementById('batchKpiContainer');
    const kpiTotalReviews = document.getElementById('kpiTotalReviews');
    const kpiPosCount = document.getElementById('kpiPosCount');
    const kpiPosPct = document.getElementById('kpiPosPct');
    const kpiNegCount = document.getElementById('kpiNegCount');
    const kpiNegPct = document.getElementById('kpiNegPct');
    const kpiNeuCount = document.getElementById('kpiNeuCount');
    const kpiNeuPct = document.getElementById('kpiNeuPct');

    const segmentedBarTrack = document.getElementById('segmentedBarTrack');
    const segPosBar = document.getElementById('segPosBar');
    const segNeuBar = document.getElementById('segNeuBar');
    const segNegBar = document.getElementById('segNegBar');
    const quickDlPosBtn = document.getElementById('quickDlPosBtn');
    const quickDlNegBtn = document.getElementById('quickDlNegBtn');
    const legendPosItem = document.getElementById('legendPosItem');
    const legendNeuItem = document.getElementById('legendNeuItem');
    const legendNegItem = document.getElementById('legendNegItem');

    // Top Highlights Elements
    const topHighlightsSection = document.getElementById('topHighlightsSection');
    const criticalReviewsList = document.getElementById('criticalReviewsList');
    const glowingReviewsList = document.getElementById('glowingReviewsList');
    const downloadNegHighlightsBtn = document.getElementById('downloadNegHighlightsBtn');
    const downloadPosHighlightsBtn = document.getElementById('downloadPosHighlightsBtn');

    // Review Explorer Elements
    const reviewExplorerSection = document.getElementById('reviewExplorerSection');
    const explorerCountText = document.getElementById('explorerCountText');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportCsvBtnLabel = document.getElementById('exportCsvBtnLabel');
    const downloadPosExplorerBtn = document.getElementById('downloadPosExplorerBtn');
    const downloadNegExplorerBtn = document.getElementById('downloadNegExplorerBtn');
    const explorerSearchInput = document.getElementById('explorerSearchInput');
    const explorerReviewsList = document.getElementById('explorerReviewsList');
    const expTabBtns = document.querySelectorAll('.exp-tab-btn');
    const cntAll = document.getElementById('cntAll');
    const cntPos = document.getElementById('cntPos');
    const cntNeg = document.getElementById('cntNeg');
    const cntNeu = document.getElementById('cntNeu');

    // Drivers & Metrics
    const posDrivers = document.getElementById('posDrivers');
    const negDrivers = document.getElementById('negDrivers');
    const statChars = document.getElementById('statChars');
    const statWords = document.getElementById('statWords');
    const statAvgLen = document.getElementById('statAvgLen');

    // State
    let currentDocumentMetadata = null;
    let currentDocumentReviews = null;
    let currentColumnReviewsMap = {};
    let currentColumnsMeta = [];
    let isPreviewCollapsed = false;
    let activeBatchReviews = [];
    let currentFilter = 'all';
    let currentSearchTerm = '';

    const SAMPLE_TEXTS = {
        positive: "The new product update is phenomenal! The user experience is wonderfully smooth, incredibly responsive, and my team's productivity has skyrocketed. Outstanding job by the development team!",
        negative: "Extremely frustrated with the latest release. The system crashes constantly, customer service was utterly unhelpful and rude, and several critical features are completely broken. Worst experience ever.",
        batch: `1. Outstanding product quality and lightning fast delivery! Highly recommended.
2. The package arrived completely damaged and customer support refused to issue a refund. Terrible!
3. Standard quality, arrived on time. Functions as advertised.
4. Absolutely stellar performance! The battery lasts two whole days and the display is gorgeous.
5. Awful experience. It stopped working after three days and the software is riddled with bugs.
6. The price is fair for what you get, nothing extraordinary but works fine.
7. Pure delight! This has revolutionized my daily workflow. Ten stars!
8. Extremely disappointed with the delayed shipping and defective charging port.`
    };

    // ==========================================
    // Tab Mode Switching
    // ==========================================
    tabDirectText.addEventListener('click', () => switchTab('text'));
    tabDocUpload.addEventListener('click', () => switchTab('document'));

    function switchTab(mode) {
        if (mode === 'text') {
            tabDirectText.classList.add('active');
            tabDocUpload.classList.remove('active');
            directTextSection.classList.remove('hidden');
            directTextSection.classList.remove('section-fade-in');
            void directTextSection.offsetWidth;
            directTextSection.classList.add('section-fade-in');
            docUploadSection.classList.add('hidden');
        } else {
            tabDocUpload.classList.add('active');
            tabDirectText.classList.remove('active');
            docUploadSection.classList.remove('hidden');
            docUploadSection.classList.remove('section-fade-in');
            void docUploadSection.offsetWidth;
            docUploadSection.classList.add('section-fade-in');
            directTextSection.classList.add('hidden');
        }
    }

    // ==========================================
    // Direct Text Input Logic with Live Typing & Shortcuts
    // ==========================================
    let presetTypingInterval = null;

    function stopPresetTyping() {
        if (presetTypingInterval) {
            clearInterval(presetTypingInterval);
            presetTypingInterval = null;
        }
        sampleChips.forEach(c => c.classList.remove('typing-active-chip'));
    }

    textInput.addEventListener('input', () => {
        stopPresetTyping();
        updateTextCounters();
    });

    // Keyboard Shortcut: Ctrl+Enter / Cmd+Enter to analyze instantly
    textInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            stopPresetTyping();
            sentimentForm.dispatchEvent(new Event('submit'));
        }
    });

    function updateTextCounters() {
        const text = textInput.value;
        charCounter.textContent = `${text.length.toLocaleString()} / 100,000 chars`;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        wordCounter.textContent = `${words.length.toLocaleString()} words`;
    }

    clearTextBtn.addEventListener('click', () => {
        stopPresetTyping();
        textInput.value = '';
        updateTextCounters();
        textInput.focus();
    });

    // Interactive Preset Chips with Live Typing Effect
    sampleChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const sampleType = chip.getAttribute('data-sample');
            const targetText = SAMPLE_TEXTS[sampleType];
            if (!targetText) return;

            stopPresetTyping();
            chip.classList.add('typing-active-chip');
            textInput.value = '';
            textInput.focus();

            let idx = 0;
            const chunkSize = targetText.length > 200 ? 3 : 1;
            const speed = targetText.length > 200 ? 6 : 14;

            presetTypingInterval = setInterval(() => {
                if (idx < targetText.length) {
                    textInput.value += targetText.slice(idx, idx + chunkSize);
                    idx += chunkSize;
                    updateTextCounters();
                    textInput.scrollTop = textInput.scrollHeight;
                } else {
                    stopPresetTyping();
                }
            }, speed);
        });
    });

    sentimentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        stopPresetTyping();
        const text = textInput.value.trim();
        if (!text) {
            alert('Please enter or paste some text or reviews to analyze.');
            return;
        }
        triggerSentimentAnalysis(text, null, null, analyzeBtn);
    });

    // ==========================================
    // Document Upload & Dropzone Logic
    // ==========================================
    dropZone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
            handleFileUpload(fileInput.files[0]);
        }
    });

    async function handleFileUpload(file) {
        if (!file) return;

        const maxBytes = 32 * 1024 * 1024;
        if (file.size > maxBytes) {
            alert(`File size exceeds 32MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB). Please upload a smaller file.`);
            return;
        }

        dropZone.classList.add('hidden');
        documentInfoCard.classList.add('hidden');
        extractLoader.classList.remove('hidden');
        extractLoaderSubtext.textContent = `Scanning "${file.name}" for reviews and columns...`;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/extract-document', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to extract text from file.');
            }

            // Populate Document Card
            currentDocumentMetadata = data.metadata;
            currentDocumentReviews = data.reviews && data.reviews.length > 0 ? data.reviews : null;
            currentColumnReviewsMap = data.metadata.column_reviews || {};

            docFilename.textContent = data.metadata.filename;
            docTypeBadge.textContent = data.metadata.extension;
            docSizeTag.textContent = data.metadata.file_size_formatted;
            docUnitsTag.textContent = `${data.metadata.units.toLocaleString()} ${data.metadata.unit_label}`;
            docWordsTag.textContent = `${data.metadata.word_count.toLocaleString()} words`;

            // Spreadsheet Column Selector Setup
            if (data.metadata.is_spreadsheet && data.metadata.columns && data.metadata.columns.length > 0) {
                columnSelectRow.classList.remove('hidden');
                columnSelect.innerHTML = '';
                columnPills.innerHTML = '';
                currentColumnsMeta = data.metadata.columns_metadata || [];

                const reviewCols = currentColumnsMeta.filter(c => c.is_review);
                const otherCols = currentColumnsMeta.filter(c => !c.is_review);

                // Optgroup for recommended review columns
                if (reviewCols.length > 0) {
                    const grpReview = document.createElement('optgroup');
                    grpReview.label = "✅ Recommended Review Columns";
                    reviewCols.forEach(col => {
                        const opt = document.createElement('option');
                        opt.value = col.name;
                        const isBest = col.name === data.metadata.selected_column;
                        opt.textContent = `📝 ${col.name} [Avg. ${col.avg_words} words/row]${isBest ? ' ★ (Recommended)' : ''}`;
                        if (isBest) opt.selected = true;
                        grpReview.appendChild(opt);
                    });
                    columnSelect.appendChild(grpReview);
                }

                // Optgroup for other/metadata/ID columns
                if (otherCols.length > 0) {
                    const grpOther = document.createElement('optgroup');
                    grpOther.label = "⚠️ Non-Review Columns (ID / Numeric / Date / User)";
                    otherCols.forEach(col => {
                        const opt = document.createElement('option');
                        opt.value = col.name;
                        const isBest = col.name === data.metadata.selected_column;
                        opt.textContent = `ℹ️ ${col.name} [${col.label}]${isBest ? ' ★ (Selected)' : ''}`;
                        if (isBest) opt.selected = true;
                        grpOther.appendChild(opt);
                    });
                    columnSelect.appendChild(grpOther);
                }

                // Render categorization summary pills
                currentColumnsMeta.forEach(col => {
                    const pill = document.createElement('span');
                    const isSelected = col.name === data.metadata.selected_column;
                    let pillClass = col.is_review ? 'pill-review' : (col.is_id ? 'pill-id' : 'pill-meta');
                    pill.className = `col-pill ${pillClass}${isSelected ? ' pill-active' : ''}`;
                    pill.setAttribute('data-col', col.name);
                    const icon = col.is_review ? '📝' : (col.is_id ? '🆔' : (col.category === 'RATING' ? '⭐' : '📅'));
                    pill.innerHTML = `<span>${icon}</span> <strong>${escapeHtml(col.name)}</strong> <small>(${col.label})</small>`;
                    
                    // Allow clicking a pill to switch column
                    pill.style.cursor = 'pointer';
                    pill.addEventListener('click', () => {
                        columnSelect.value = col.name;
                        columnSelect.dispatchEvent(new Event('change'));
                    });
                    columnPills.appendChild(pill);
                });

                colDetectedHint.textContent = `★ ${data.metadata.selected_column} auto-selected`;
                checkColumnWarning(data.metadata.selected_column);
            } else {
                columnSelectRow.classList.add('hidden');
                columnWarningAlert.classList.add('hidden');
            }

            if (data.metadata.is_batch) {
                docBatchTag.classList.remove('hidden');
                docBatchTag.textContent = `Batch: ${data.metadata.review_count.toLocaleString()} reviews`;
                analyzeDocBtnText.textContent = `Analyze ${data.metadata.review_count.toLocaleString()} Reviews`;
            } else {
                docBatchTag.classList.add('hidden');
                analyzeDocBtnText.textContent = `Analyze Document Sentiment`;
            }

            extractedTextarea.value = data.text;

            extractLoader.classList.add('hidden');
            documentInfoCard.classList.remove('hidden');

        } catch (error) {
            console.error('File Extraction Error:', error);
            alert(`Document Extraction Failed: ${error.message}`);
            extractLoader.classList.add('hidden');
            dropZone.classList.remove('hidden');
            fileInput.value = '';
        }
    }

    // Column Selector Dropdown Change Handler
    columnSelect.addEventListener('change', () => {
        const chosenCol = columnSelect.value;
        if (!chosenCol || !currentColumnReviewsMap[chosenCol]) return;

        const newReviews = currentColumnReviewsMap[chosenCol];
        currentDocumentReviews = newReviews;
        extractedTextarea.value = newReviews.join('\n\n');

        const isOriginalBest = chosenCol === currentDocumentMetadata.selected_column;
        colDetectedHint.textContent = isOriginalBest ? `★ ${chosenCol} (Recommended)` : `Using column: ${chosenCol}`;

        // Update active pill highlight
        document.querySelectorAll('.col-pill').forEach(p => {
            p.classList.toggle('pill-active', p.getAttribute('data-col') === chosenCol);
        });

        checkColumnWarning(chosenCol);

        // Update tags and buttons
        docUnitsTag.textContent = `${newReviews.length.toLocaleString()} reviews`;
        analyzeDocBtnText.textContent = `Analyze ${newReviews.length.toLocaleString()} Reviews`;
        docBatchTag.textContent = `Batch: ${newReviews.length.toLocaleString()} reviews`;

        // Update words estimate
        const totalWords = newReviews.reduce((sum, r) => sum + r.split(/\s+/).filter(w => w.length > 0).length, 0);
        docWordsTag.textContent = `${totalWords.toLocaleString()} words`;
    });

    function checkColumnWarning(colName) {
        const meta = currentColumnsMeta.find(c => c.name === colName);
        if (meta && (meta.is_id || meta.category === 'RATING' || meta.category === 'DATE' || meta.category === 'EMPTY')) {
            columnWarningAlert.classList.remove('hidden');
            columnWarningText.textContent = `⚠️ Notice: "${colName}" is categorized as ${meta.label}. For genuine sentiment analysis, please ensure you select an actual review text column.`;
        } else {
            columnWarningAlert.classList.add('hidden');
        }
    }

    togglePreviewBtn.addEventListener('click', () => {
        isPreviewCollapsed = !isPreviewCollapsed;
        if (isPreviewCollapsed) {
            extractedTextarea.classList.add('collapsed');
            togglePreviewBtn.textContent = 'Expand View';
        } else {
            extractedTextarea.classList.remove('collapsed');
            togglePreviewBtn.textContent = 'Collapse View';
        }
    });

    removeDocBtn.addEventListener('click', () => {
        currentDocumentMetadata = null;
        currentDocumentReviews = null;
        currentColumnReviewsMap = {};
        currentColumnsMeta = [];
        columnPills.innerHTML = '';
        columnWarningAlert.classList.add('hidden');
        fileInput.value = '';
        extractedTextarea.value = '';
        documentInfoCard.classList.add('hidden');
        columnSelectRow.classList.add('hidden');
        dropZone.classList.remove('hidden');
    });

    analyzeDocBtn.addEventListener('click', () => {
        const text = extractedTextarea.value.trim();
        if (!text && (!currentDocumentReviews || currentDocumentReviews.length === 0)) {
            alert('No extracted content available to analyze.');
            return;
        }
        triggerSentimentAnalysis(text, currentDocumentMetadata, currentDocumentReviews, analyzeDocBtn);
    });

    // ==========================================
    // SentiBot Assistant Controller & State Machine
    // ==========================================
    const robotAssistant = {
        container: document.getElementById('robotAssistant'),
        speechBubble: document.getElementById('robotSpeechBubble'),
        speechText: document.getElementById('robotMessage'),
        stateBadge: document.getElementById('robotStateBadge'),
        robotVideo: document.getElementById('robotAvatarVideo'),
        robotCanvas: document.getElementById('robotCanvas'),
        robotImg: document.getElementById('robotAvatarImg'),
        podBtn: document.getElementById('robotPodBtn'),
        toggleBtn: document.getElementById('robotToggleBtn'),
        toggleLabel: document.getElementById('robotToggleLabel'),

        currentState: 'idle',
        isMinimized: false,
        messageTimer: null,
        resetTimer: null,

        // Optional matching expression image support if added to public/robot/
        expressionAssets: {
            'idle': '/robot/robot.jpg',
            'welcome': '/robot/robot.jpg',
            'thinking': '/robot/robot.jpg',
            'success': '/robot/robot.jpg',
            'positive': '/robot/robot.jpg',
            'negative': '/robot/robot.jpg',
            'neutral': '/robot/robot.jpg',
            'error': '/robot/robot.jpg'
        },

        init() {
            if (!this.container) return;

            // Handle video element & fallback if video fails to load
            if (this.robotVideo) {
                this.robotVideo.addEventListener('error', () => {
                    console.warn('Robot video failed to load, falling back to image.');
                    if (this.robotCanvas) {
                        this.robotCanvas.style.display = 'none';
                    }
                    if (this.robotImg) {
                        this.robotImg.classList.remove('hidden');
                    }
                });

                // Start real-time background removal onto canvas
                this.setupTransparentVideo();

                // Ensure muted continuous autoplay across modern browsers
                this.robotVideo.muted = true;
                const playPromise = this.robotVideo.play();
                if (playPromise !== undefined) {
                    playPromise.catch((e) => {
                        console.log('Video autoplay deferred by browser until interaction:', e);
                    });
                }
            }

            // Tap speech bubble to dismiss
            if (this.speechBubble) {
                this.speechBubble.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.speechBubble.classList.add('bubble-hidden');
                    this.speechBubble.classList.remove('bubble-active-mobile');
                });
            }

            // Interactive Pod Click
            if (this.podBtn) {
                this.podBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.robotVideo && this.robotVideo.paused) {
                        this.robotVideo.play().catch(() => {});
                    }
                    if (window.innerWidth <= 768 && this.speechBubble) {
                        const isVisible = this.speechBubble.classList.contains('bubble-active-mobile') && !this.speechBubble.classList.contains('bubble-hidden');
                        if (isVisible) {
                            this.speechBubble.classList.add('bubble-hidden');
                            this.speechBubble.classList.remove('bubble-active-mobile');
                            return;
                        }
                    }
                    this.handleUserInteraction();
                });
            }

            // Mobile auto-dismiss on scroll or tap outside
            window.addEventListener('scroll', () => {
                if (window.innerWidth <= 768 && this.speechBubble) {
                    this.speechBubble.classList.add('bubble-hidden');
                    this.speechBubble.classList.remove('bubble-active-mobile');
                }
            }, { passive: true });

            document.addEventListener('touchstart', (e) => {
                if (window.innerWidth <= 768 && this.speechBubble && this.container && !this.container.contains(e.target)) {
                    this.speechBubble.classList.add('bubble-hidden');
                    this.speechBubble.classList.remove('bubble-active-mobile');
                }
            }, { passive: true });

            // Minimize / Restore Toggle
            if (this.toggleBtn) {
                this.toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleMinimize();
                });
            }

            // Welcome greeting on page load, then settle into idle
            const isMobileInit = window.innerWidth <= 768;
            this.setState('welcome', "Hi! I'm here to help you understand sentiment.", isMobileInit);
            if (isMobileInit && this.speechBubble) {
                this.speechBubble.classList.add('bubble-hidden');
                this.speechBubble.classList.remove('bubble-active-mobile');
            }
            setTimeout(() => {
                if (this.currentState === 'welcome') {
                    this.setState('idle', "Ready when you are! Type text or drop a file.", true);
                }
            }, 3600);
        },

        setState(stateName, customMessage = null, autoHideBubble = false) {
            if (!this.container) return;
            this.currentState = stateName;

            // Clean up state-* classes
            this.container.classList.remove(
                'state-idle', 'state-welcome', 'state-thinking', 'state-success',
                'state-positive', 'state-negative', 'state-neutral', 'state-error'
            );
            this.container.classList.add(`state-${stateName}`);

            // Update state badge
            if (this.stateBadge) {
                const labels = {
                    'idle': 'Idle',
                    'welcome': 'Welcome',
                    'thinking': 'Thinking...',
                    'success': 'Ready!',
                    'positive': 'Positive 😄',
                    'negative': 'Critical 😔',
                    'neutral': 'Neutral 😐',
                    'error': 'Error ⚠️'
                };
                this.stateBadge.textContent = labels[stateName] || stateName;
            }

            // Contextual Assistant Messages
            const defaultMessages = {
                'idle': "Ready when you are! Type some text or drop a file.",
                'welcome': "Hi! I'm ZendiBot. I'm here to help you analyze sentiment.",
                'thinking': "Let me take a closer look...",
                'success': "Your analysis is ready!",
                'positive': "Looks like a wonderful, positive tone!",
                'negative': "I noticed some critical issues and negative points.",
                'neutral': "This text is balanced and factual.",
                'error': "Something went wrong. Let's try again."
            };

            const msg = customMessage || defaultMessages[stateName];
            if (msg && this.speechText) {
                this.speechText.textContent = msg;
            }

            // Graceful expression image fallback/switch
            if (this.robotImg && this.expressionAssets[stateName]) {
                const targetSrc = this.expressionAssets[stateName];
                if (targetSrc && targetSrc !== this.robotImg.getAttribute('src')) {
                    const probe = new Image();
                    probe.onload = () => { this.robotImg.src = targetSrc; };
                    probe.onerror = () => { this.robotImg.src = '/robot/robot.jpg'; };
                    probe.src = targetSrc;
                }
            }

            const isMobile = window.innerWidth <= 768;
            if (this.speechBubble) {
                this.speechBubble.classList.remove('bubble-hidden');
                if (isMobile) {
                    this.speechBubble.classList.add('bubble-active-mobile');
                }
            }

            if (this.messageTimer) clearTimeout(this.messageTimer);
            if (autoHideBubble || isMobile) {
                this.messageTimer = setTimeout(() => {
                    if (this.speechBubble) {
                        this.speechBubble.classList.add('bubble-hidden');
                        this.speechBubble.classList.remove('bubble-active-mobile');
                    }
                }, isMobile ? 2600 : 7000);
            }
        },

        handleUserInteraction() {
            const tips = [
                "Tip: You can drag & drop Excel, CSV, PDF, or Word files directly!",
                "Tip: Press Ctrl + Enter to run your analysis quickly.",
                "Tip: Hover over any highlighted word in the emotion map to see its score!",
                "Tip: Click on any mood category card to filter positive or critical entries.",
                "Tip: Export your full sentiment report or filtered reviews as CSV or JSON with one click!",
                "Tip: Switch between Light and Dark mode anytime using the button in the top right header!"
            ];
            const randomTip = tips[Math.floor(Math.random() * tips.length)];
            this.setState('welcome', randomTip, false);

            if (this.resetTimer) clearTimeout(this.resetTimer);
            this.resetTimer = setTimeout(() => {
                if (this.currentState === 'welcome') {
                    this.setState('idle', "Ready when you are!", true);
                }
            }, 5500);
        },

        toggleMinimize() {
            this.isMinimized = !this.isMinimized;
            this.container.classList.toggle('is-minimized', this.isMinimized);
            if (this.toggleLabel) {
                this.toggleLabel.textContent = this.isMinimized ? 'Expand' : 'Assistant';
            }
        },

        setupTransparentVideo() {
            const video = this.robotVideo;
            const canvas = this.robotCanvas;
            if (!video || !canvas) return;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;

            // Mascot bounding box crop
            const cropX = 350;
            const cropY = 20;
            const cropSize = 680;

            let animId = null;
            let isRendering = false;
            let lastFrameTime = 0;
            const FRAME_INTERVAL = 40; // 25 FPS provides smooth mascot animation while saving 65% CPU

            // Offscreen canvas for pixel extraction and keying calculations
            const offscreen = document.createElement('canvas');
            offscreen.width = canvas.width;
            offscreen.height = canvas.height;
            const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

            const processFrame = (now) => {
                if (document.hidden || this.isMinimized || video.paused || video.ended || video.readyState < 2) {
                    animId = requestAnimationFrame(processFrame);
                    return;
                }

                if (now - lastFrameTime < FRAME_INTERVAL) {
                    animId = requestAnimationFrame(processFrame);
                    return;
                }
                lastFrameTime = now;

                const w = canvas.width;
                const h = canvas.height;

                try {
                    offCtx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, w, h);
                    const imgData = offCtx.getImageData(0, 0, w, h);
                    const d = imgData.data;
                    const len = d.length;

                    for (let i = 0; i < len; i += 4) {
                        const r = d[i];
                        const g = d[i + 1];
                        const b = d[i + 2];

                        const maxC = (r > g) ? (r > b ? r : b) : (g > b ? g : b);
                        const minC = (r < g) ? (r < b ? r : b) : (g < b ? g : b);
                        const diff = maxC - minC;
                        const bright = (r + g + b) / 3;

                        // Neutral/monochromatic studio bright background removal
                        if (diff < 24 && bright > 200) {
                            d[i + 3] = 0;
                        } else if (diff < 30 && bright >= 175 && bright <= 200) {
                            const alphaFactor = (200 - bright) / 25;
                            d[i + 3] = Math.round(d[i + 3] * alphaFactor);
                        }
                    }

                    ctx.putImageData(imgData, 0, 0);
                } catch (err) {
                    try {
                        ctx.clearRect(0, 0, w, h);
                        ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, w, h);
                    } catch (_) {}
                }

                animId = requestAnimationFrame(processFrame);
            };

            const startRendering = () => {
                if (!isRendering) {
                    isRendering = true;
                    animId = requestAnimationFrame(processFrame);
                }
            };

            video.addEventListener('play', startRendering);
            video.addEventListener('playing', startRendering);
            video.addEventListener('loadeddata', startRendering);

            if (!video.paused && video.readyState >= 2) {
                startRendering();
            }

            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && !video.paused) {
                    startRendering();
                }
            });
        }
    };

    // Initialize Assistant
    robotAssistant.init();

    // ==========================================
    // Unified Sentiment Analysis Request
    // ==========================================
    async function triggerSentimentAnalysis(text, docInfo, reviewsList, buttonElement) {
        setButtonLoading(buttonElement, true);
        resultsEmptyState.classList.add('hidden');
        resultsContent.classList.add('hidden');
        resultsLoader.classList.remove('hidden');

        // On mobile viewports, smoothly scroll to results card so user immediately sees progress
        if (window.innerWidth <= 1024) {
            const resultsCard = document.getElementById('resultsCard') || resultsLoader;
            if (resultsCard) {
                setTimeout(() => {
                    resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 80);
            }
        }

        // Assistant transitions to thinking state while analysis runs
        robotAssistant.setState('thinking', "Let me take a closer look...");

        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    document_info: docInfo,
                    reviews: reviewsList
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Server error during sentiment analysis.');
            }

            renderResults(data);

        } catch (error) {
            console.error('Sentiment Analysis Error:', error);
            robotAssistant.setState('error', "Something went wrong. Let's try again.");
            alert(`Analysis failed: ${error.message}`);
            resultsLoader.classList.add('hidden');
            resultsEmptyState.classList.remove('hidden');
        } finally {
            setButtonLoading(buttonElement, false);
        }
    }

    function setButtonLoading(btn, isLoading) {
        if (!btn) return;
        const textSpan = btn.querySelector('.btn-text');
        const iconSvg = btn.querySelector('.btn-icon');
        const loader = btn.querySelector('.btn-loader');

        if (isLoading) {
            btn.disabled = true;
            if (textSpan) textSpan.classList.add('hidden');
            if (iconSvg) iconSvg.classList.add('hidden');
            if (loader) loader.classList.remove('hidden');
        } else {
            btn.disabled = false;
            if (textSpan) textSpan.classList.remove('hidden');
            if (iconSvg) iconSvg.classList.remove('hidden');
            if (loader) loader.classList.add('hidden');
        }
    }

    // ==========================================
    // Render Results & Metrics
    // ==========================================
    function renderResults(data) {
        resultsLoader.classList.add('hidden');
        resultsContent.classList.remove('hidden');

        // Document Banner
        if (data.document_info && data.document_info.filename) {
            resultDocBanner.classList.remove('hidden');
            const colName = columnSelect && !columnSelectRow.classList.contains('hidden') ? ` • Col: "${columnSelect.value}"` : '';
            bannerDocName.textContent = `${data.document_info.filename}${colName} • ${data.document_info.units.toLocaleString()} ${data.document_info.unit_label}`;
        } else {
            resultDocBanner.classList.add('hidden');
        }

        // Typewriter Effect Helper for Headings/Results
        function typewriterText(element, fullText, speed = 14) {
            if (!element) return;
            element.textContent = '';
            let i = 0;
            function next() {
                if (i < fullText.length) {
                    element.textContent += fullText.charAt(i);
                    i++;
                    setTimeout(next, speed);
                }
            }
            next();
        }

        // Cyber Unscramble / Decoder Text Reveal Animation
        function scrambleText(element, targetText, duration = 400) {
            if (!element) return;
            const glyphs = '✦✧█▓▒░ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            const startTime = performance.now();
            function update(now) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const revealIdx = Math.floor(progress * targetText.length);
                let current = targetText.slice(0, revealIdx);
                for (let i = revealIdx; i < targetText.length; i++) {
                    if (targetText[i] === ' ') {
                        current += ' ';
                    } else {
                        current += glyphs[Math.floor(Math.random() * glyphs.length)];
                    }
                }
                element.textContent = current;
                if (progress < 1) {
                    requestAnimationFrame(update);
                } else {
                    element.textContent = targetText;
                }
            }
            requestAnimationFrame(update);
        }

        // Particle & Confetti Celebration Engine
        function triggerCelebration(isDelight = true) {
            const canvas = document.getElementById('celebrationCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            const palette = isDelight
                ? ['#22C55E', '#4ADE80', '#F5C842', '#38BDF8', '#FB7185', '#A78BFA']
                : ['#F5C842', '#FDE047', '#FEF08A'];
            const particles = [];
            const isMobile = window.innerWidth <= 768;
            const count = isMobile ? (isDelight ? 28 : 14) : (isDelight ? 75 : 30);

            for (let i = 0; i < count; i++) {
                particles.push({
                    x: window.innerWidth * 0.72 + (Math.random() - 0.5) * 220,
                    y: window.innerHeight * 0.38 + (Math.random() - 0.5) * 120,
                    vx: (Math.random() - 0.5) * 13,
                    vy: Math.random() * -11 - 4,
                    size: Math.random() * 8 + 4,
                    color: palette[Math.floor(Math.random() * palette.length)],
                    alpha: 1,
                    rotation: Math.random() * 360,
                    rotSpeed: (Math.random() - 0.5) * 12,
                    isRect: Math.random() > 0.4
                });
            }

            let animFrame;
            function runAnim() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                let hasLive = false;
                particles.forEach(p => {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.32; // subtle gravity
                    p.alpha -= 0.016;
                    p.rotation += p.rotSpeed;

                    if (p.alpha > 0) {
                        hasLive = true;
                        ctx.save();
                        ctx.globalAlpha = Math.max(0, p.alpha);
                        ctx.translate(p.x, p.y);
                        ctx.rotate((p.rotation * Math.PI) / 180);
                        ctx.fillStyle = p.color;
                        if (p.isRect) {
                            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
                        } else {
                            ctx.beginPath();
                            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        ctx.restore();
                    }
                });

                if (hasLive) {
                    animFrame = requestAnimationFrame(runAnim);
                } else {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    cancelAnimationFrame(animFrame);
                }
            }
            runAnim();
        }

        // Interactive Revealing Emotion Word Map
        function renderEmotionScan(text, posList, negList) {
            if (!emotionScanSection || !emotionScanContent) return;

            if (!text || text.trim().length === 0) {
                emotionScanSection.classList.add('hidden');
                return;
            }

            emotionScanSection.classList.remove('hidden');

            const posMap = new Map();
            (posList || []).forEach(item => posMap.set(item.word.toLowerCase(), item.score));
            const negMap = new Map();
            (negList || []).forEach(item => negMap.set(item.word.toLowerCase(), item.score));

            // Tokenize while keeping punctuation and spacing
            const tokens = text.split(/(\s+|[.,!?;:()"])/);
            let resultHtml = '';

            tokens.forEach(tok => {
                const cleaned = tok.trim().toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
                if (posMap.has(cleaned)) {
                    const score = posMap.get(cleaned);
                    const pct = Math.round(score * 100);
                    resultHtml += `<span class="emotion-word-pill pos" tabindex="0">${escapeHtml(tok)}<span class="emotion-tooltip">✨ Positive feeling (+${pct}%)</span></span>`;
                } else if (negMap.has(cleaned)) {
                    const score = negMap.get(cleaned);
                    const pct = Math.round(score * 100);
                    resultHtml += `<span class="emotion-word-pill neg" tabindex="0">${escapeHtml(tok)}<span class="emotion-tooltip">⚠️ Critical feeling (${pct}%)</span></span>`;
                } else {
                    resultHtml += escapeHtml(tok);
                }
            });

            emotionScanContent.innerHTML = resultHtml;

            // Micro-interaction on pill click
            emotionScanContent.querySelectorAll('.emotion-word-pill').forEach(pill => {
                pill.addEventListener('click', () => {
                    pill.style.transform = 'scale(1.25)';
                    setTimeout(() => { pill.style.transform = ''; }, 200);
                });
            });
        }

        // Overall Sentiment Badge with Cyber Decoder Reveal
        scrambleText(sentimentText, data.sentiment, 420);
        sentimentBadge.className = `sentiment-badge ${data.class_name}`;

        // Expressive Mood Reaction Orb & Reaction Emoji
        const compound = data.scores.compound;
        if (moodReactionOrb && moodReactionEmoji) {
            moodReactionOrb.className = `mood-reaction-orb ${data.class_name}`;
            if (compound >= 0.45) {
                moodReactionEmoji.textContent = '🤩';
            } else if (compound >= 0.05) {
                moodReactionEmoji.textContent = '😄';
            } else if (compound > -0.05) {
                moodReactionEmoji.textContent = '😌';
            } else if (compound > -0.45) {
                moodReactionEmoji.textContent = '🙁';
            } else {
                moodReactionEmoji.textContent = '🚨';
            }
        }

        // Soundwave Equalizer Activation
        if (soundwaveEqualizer) {
            soundwaveEqualizer.className = `soundwave-equalizer active ${data.class_name}`;
        }

        const isBatch = !!data.batch_analysis;
        resultsTitle.textContent = isBatch ? "Document Tone & Sentiment Breakdown" : "Tone & Sentiment Breakdown";
        resultsTitle.classList.remove('reveal-heading-ltr');
        void resultsTitle.offsetWidth; // re-trigger animation
        resultsTitle.classList.add('reveal-heading-ltr');

        const subtitleMsg = isBatch 
            ? `${data.batch_analysis.total_reviews.toLocaleString()} entries analyzed across your file` 
            : "Evaluated using natural language tone & emotion analysis";
        typewriterText(resultsSubtitle, subtitleMsg, 16);

        // Mood Energy Score & Percentage Badge
        compoundValue.textContent = (compound > 0 ? '+' : '') + compound.toFixed(2);
        const percent = Math.min(Math.max(((compound + 1) / 2) * 100, 2), 98);
        meterPointer.style.left = `${percent}%`;

        if (meterGlowFill) {
            meterGlowFill.style.width = `${percent}%`;
            meterGlowFill.style.background = compound >= 0.05 
                ? 'rgba(34, 197, 94, 0.35)' 
                : (compound <= -0.05 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)');
        }

        if (moodPercentageText) {
            const pct = Math.round(compound * 100);
            moodPercentageText.textContent = (pct >= 0 ? '+' : '') + pct + '%';
            moodPercentageText.className = `mood-pct-badge ${data.class_name}`;
        }

        // Update Meter Tooltip Default
        const meterTooltip = document.getElementById('meterTooltip');
        if (meterTooltip) {
            meterTooltip.style.left = `${percent}%`;
            meterTooltip.textContent = `Mood: ${(compound > 0 ? '+' : '') + compound.toFixed(2)} (${data.sentiment})`;
        }

        // Plain-English Score Explainer with Typewriter Effect
        const compoundExplainer = document.getElementById('compoundExplainer');
        if (compoundExplainer) {
            let explanation = '';
            if (compound >= 0.5) {
                explanation = '✨ Radiating Joy — Feedback is extraordinarily glowing and enthusiastic!';
            } else if (compound >= 0.05) {
                explanation = '🌱 Favorably Positive — Warm, encouraging reception with satisfied feedback.';
            } else if (compound > -0.05) {
                explanation = '⚖️ Balanced & Neutral — Objective, informative, or balanced remarks.';
            } else if (compound > -0.5) {
                explanation = '⚠️ Noticeable Friction — Dissatisfaction, unmet expectations, or complaints noted.';
            } else {
                explanation = '🚨 Critical Discontent — Strong frustration requiring immediate intervention!';
            }
            typewriterText(compoundExplainer, explanation, 13);
        }

        // Trigger Celebration on Delightful Scores
        if (compound >= 0.25) {
            triggerCelebration(compound >= 0.5);
        }

        // Render Interactive Emotion Word Scan
        const rawContent = textInput.value || (extractedTextarea ? extractedTextarea.value.slice(0, 1000) : '');
        renderEmotionScan(rawContent, data.drivers.positive, data.drivers.negative);

        // Animated Counter Helper
        function animateValue(elem, target) {
            if (!elem) return;
            const startVal = parseInt(elem.textContent.replace(/[^0-9]/g, '')) || 0;
            const startTime = performance.now();
            const duration = 500;
            function step(now) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeOut = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(startVal + (target - startVal) * easeOut);
                elem.textContent = current.toLocaleString();
                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    elem.textContent = target.toLocaleString();
                }
            }
            requestAnimationFrame(step);
        }

        // BATCH REVIEWS INTELLIGENCE
        if (isBatch) {
            batchKpiContainer.classList.remove('hidden');
            topHighlightsSection.classList.remove('hidden');
            reviewExplorerSection.classList.remove('hidden');

            const batch = data.batch_analysis;
            activeBatchReviews = batch.reviews || [];

            // Update KPI Cards with Smooth Counting
            animateValue(kpiTotalReviews, batch.total_reviews);
            animateValue(kpiPosCount, batch.pos_count);
            animateValue(kpiNegCount, batch.neg_count);
            animateValue(kpiNeuCount, batch.neu_count);
            
            kpiPosPct.textContent = `${batch.pos_pct}%`;
            kpiNegPct.textContent = `${batch.neg_pct}%`;
            kpiNeuPct.textContent = `${batch.neu_pct}%`;

            // Reset active KPI card highlight
            document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('kpi-active-filter'));
            const totalKpiCard = document.getElementById('kpiCardTotal');
            if (totalKpiCard) totalKpiCard.classList.add('kpi-active-filter');

            // Segmented Progress Bar & Tooltips
            segPosBar.style.width = `${batch.pos_pct}%`;
            segNeuBar.style.width = `${batch.neu_pct}%`;
            segNegBar.style.width = `${batch.neg_pct}%`;
            segPosBar.title = `Positive: ${batch.pos_count.toLocaleString()} (${batch.pos_pct}%) - Click to filter & download`;
            segNeuBar.title = `Neutral: ${batch.neu_count.toLocaleString()} (${batch.neu_pct}%) - Click to filter`;
            segNegBar.title = `Negative: ${batch.neg_count.toLocaleString()} (${batch.neg_pct}%) - Click to filter & download`;

            if (quickDlPosBtn) {
                quickDlPosBtn.title = `Download all ${batch.pos_count.toLocaleString()} positive entries as CSV`;
            }
            if (quickDlNegBtn) {
                quickDlNegBtn.title = `Download all ${batch.neg_count.toLocaleString()} negative entries as CSV`;
            }

            // Top Highlights Callouts
            renderHighlightBox(criticalReviewsList, batch.top_negative, 'score-neg');
            renderHighlightBox(glowingReviewsList, batch.top_positive, 'score-pos');

            // Explorer Counters
            cntAll.textContent = batch.total_reviews.toLocaleString();
            cntPos.textContent = batch.pos_count.toLocaleString();
            cntNeg.textContent = batch.neg_count.toLocaleString();
            cntNeu.textContent = batch.neu_count.toLocaleString();

            // Reset Explorer Filters & Context
            currentSearchTerm = '';
            explorerSearchInput.value = '';
            setExplorerFilter('all', false);

        } else {
            batchKpiContainer.classList.add('hidden');
            topHighlightsSection.classList.add('hidden');
            reviewExplorerSection.classList.add('hidden');
        }

        // Vocabulary Sentiment Drivers
        renderDrivers(posDrivers, data.drivers.positive, 'tag-pos');
        renderDrivers(negDrivers, data.drivers.negative, 'tag-neg');

        // Text & Document Statistics (Safely guarded)
        if (statWords && data.metrics) statWords.textContent = data.metrics.word_count.toLocaleString();
        if (statChars && data.metrics) statChars.textContent = data.metrics.char_count.toLocaleString();
        if (statAvgLen && data.metrics) statAvgLen.textContent = data.metrics.avg_word_len.toFixed(1);

        // Store current analysis result for Suggested Improvements modal
        currentAnalysisData = data;
        currentAnalysisImprovements = data.improvements || [];

        // Update Robot Assistant to reflect real analysis outcome (strictly Positive, Negative, or Neutral)
        if (typeof robotAssistant !== 'undefined' && robotAssistant.setState) {
            robotAssistant.setState('success', "Your analysis is ready!");
            setTimeout(() => {
                const cls = data.class_name;
                if (cls === 'positive') {
                    robotAssistant.setState('positive', "Looks like a wonderful, positive tone!");
                } else if (cls === 'negative') {
                    robotAssistant.setState('negative', "I noticed some critical issues and friction points.");
                } else {
                    robotAssistant.setState('neutral', "This text is balanced and factual.");
                }
            }, 1400);
        }

        // Smoothly bring results card into focus on mobile devices
        if (window.innerWidth <= 1024) {
            const resultsCard = document.getElementById('resultsCard') || resultsContent;
            if (resultsCard) {
                setTimeout(() => {
                    resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        }
    }

    // Helper: Copy review text to clipboard
    function copyReviewText(text, btn) {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(text).then(() => {
            const oldHtml = btn.innerHTML;
            btn.classList.add('copied');
            btn.innerHTML = '✓ Copied!';
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = oldHtml;
            }, 1800);
        }).catch(err => console.warn('Clipboard write error', err));
    }

    // Helper: Format review text cleanly without artificial text highlighting
    function formatHighlightedText(text, term) {
        return escapeHtml(text);
    }

    function renderHighlightBox(container, list, scoreClass) {
        container.innerHTML = '';
        if (!list || list.length === 0) {
            container.innerHTML = '<span class="empty-tag">None detected in this range</span>';
            return;
        }

        list.slice(0, 3).forEach(item => {
            const div = document.createElement('div');
            div.className = 'highlight-item';
            div.innerHTML = `
                <div class="highlight-item-header">
                    <span class="highlight-item-id">Entry #${item.id}</span>
                    <div class="rev-header-actions">
                        <span class="highlight-item-score ${scoreClass}">${item.compound > 0 ? '+' : ''}${item.compound.toFixed(2)}</span>
                        <button type="button" class="rev-copy-btn" title="Copy text">📋 Copy</button>
                    </div>
                </div>
                <p class="highlight-item-text">"${escapeHtml(item.text)}"</p>
            `;
            const copyBtn = div.querySelector('.rev-copy-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    copyReviewText(item.text, copyBtn);
                });
            }
            container.appendChild(div);
        });
    }

    // ==========================================
    // Suggested Improvements Feature Controller
    // ==========================================
    function openImprovementsModal() {
        if (!improvementsModal || !currentAnalysisData) return;

        // Set dominant sentiment context
        const sentimentLabel = currentAnalysisData.sentiment || 'Neutral 😐';
        const className = currentAnalysisData.class_name || 'neutral';
        const conf = currentAnalysisData.confidence || 'Moderate';
        const confPct = currentAnalysisData.confidence_pct || 80;
        const confMsg = currentAnalysisData.confidence_message || 'Dominant sentiment evaluated from context.';

        if (improvementsSentimentBadge) {
            improvementsSentimentBadge.textContent = sentimentLabel;
            improvementsSentimentBadge.className = `improvements-sent-badge ${className === 'positive' ? 'pos' : (className === 'negative' ? 'neg' : 'neu')}`;
        }

        if (improvementsConfidenceText) {
            improvementsConfidenceText.textContent = `${conf} Confidence (${confPct}%)`;
        }

        if (improvementsRationaleMsg) {
            improvementsRationaleMsg.textContent = confMsg;
        }

        // Populate cards list
        if (improvementsCardsList) {
            improvementsCardsList.innerHTML = '';
            const list = currentAnalysisImprovements && currentAnalysisImprovements.length > 0 
                ? currentAnalysisImprovements 
                : [
                    {
                        icon: '📊',
                        title: 'Keep Gathering Customer Feedback',
                        category: 'Continuous Listening',
                        priority: 'Keep Doing This!',
                        description: 'Listening to regular customer input helps you spot trends early and make proactive improvements before issues escalate.',
                        action: 'Check in on feedback weekly and celebrate improvements with your team.'
                    }
                ];

            list.forEach(item => {
                const div = document.createElement('div');
                div.className = 'improvement-item';
                
                let pillClass = 'priority-med';
                const p = (item.priority || '').toLowerCase();
                if (p.includes('attention') || p.includes('high')) {
                    pillClass = 'priority-high';
                } else if (p.includes('growth') || p.includes('opportunity') || p.includes('key')) {
                    pillClass = 'priority-key';
                } else if (p.includes('keep') || p.includes('maint') || p.includes('strength')) {
                    pillClass = 'priority-maint';
                } else {
                    pillClass = 'priority-med';
                }

                const iconHtml = item.icon ? `<span class="improvement-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>` : '';
                const actionHtml = item.action ? `
                    <div class="improvement-action-box">
                        <span class="improvement-action-badge">👉 Next Step:</span>
                        <span class="improvement-action-text">${escapeHtml(item.action)}</span>
                    </div>
                ` : '';

                div.innerHTML = `
                    <div class="improvement-item-header">
                        <div class="improvement-cat-wrap">
                            ${iconHtml}
                            <span class="improvement-category">${escapeHtml(item.category || 'Tip')}</span>
                        </div>
                        <span class="priority-pill ${pillClass}">${escapeHtml(item.priority || 'Action')}</span>
                    </div>
                    <h5 class="improvement-title">${escapeHtml(item.title)}</h5>
                    <p class="improvement-desc">${escapeHtml(item.description)}</p>
                    ${actionHtml}
                `;
                improvementsCardsList.appendChild(div);
            });
        }

        improvementsModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeImprovementsModal() {
        if (!improvementsModal) return;
        improvementsModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    if (suggestedImprovementsBtn) {
        suggestedImprovementsBtn.addEventListener('click', openImprovementsModal);
    }

    if (closeImprovementsModalBtn) {
        closeImprovementsModalBtn.addEventListener('click', closeImprovementsModal);
    }

    if (dismissImprovementsBtn) {
        dismissImprovementsBtn.addEventListener('click', closeImprovementsModal);
    }

    if (improvementsModal) {
        improvementsModal.addEventListener('click', (e) => {
            if (e.target === improvementsModal) {
                closeImprovementsModal();
            }
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && improvementsModal && !improvementsModal.classList.contains('hidden')) {
            closeImprovementsModal();
        }
    });

    if (copyImprovementsBtn) {
        copyImprovementsBtn.addEventListener('click', () => {
            if (!currentAnalysisData) return;
            const sentimentLabel = currentAnalysisData.sentiment || 'Neutral';
            let text = `ZendiMind.ai - Suggested Improvements\n`;
            text += `Dominant Sentiment: ${sentimentLabel} (${currentAnalysisData.confidence || 'Moderate'} Confidence)\n`;
            text += `Context: ${currentAnalysisData.confidence_message || ''}\n\n`;

            (currentAnalysisImprovements || []).forEach((item, idx) => {
                text += `${idx + 1}. [${item.priority || 'Tip'}] ${item.title}\n`;
                text += `   Category: ${item.category || 'General'}\n`;
                text += `   Why it matters: ${item.description}\n`;
                if (item.action) {
                    text += `   👉 Next Step: ${item.action}\n`;
                }
                text += `\n`;
            });

            navigator.clipboard.writeText(text.trim()).then(() => {
                const oldText = copyImprovementsBtnText ? copyImprovementsBtnText.textContent : 'Copy Recommendations';
                copyImprovementsBtn.classList.add('copied');
                if (copyImprovementsBtnText) copyImprovementsBtnText.textContent = '✓ Copied!';
                setTimeout(() => {
                    copyImprovementsBtn.classList.remove('copied');
                    if (copyImprovementsBtnText) copyImprovementsBtnText.textContent = oldText;
                }, 1800);
            }).catch(err => console.warn('Clipboard write error', err));
        });
    }

    // ==========================================
    // Interactive Review Explorer Filtering & Highlighting
    // ==========================================
    function setExplorerFilter(filterType, shouldScroll = false) {
        currentFilter = filterType;

        // Update tab buttons
        expTabBtns.forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-filter') === filterType);
        });

        // Update KPI cards active outline
        document.querySelectorAll('.kpi-card').forEach(c => {
            c.classList.toggle('kpi-active-filter', c.getAttribute('data-filter') === filterType);
        });

        // Context-aware export button label
        if (exportCsvBtnLabel) {
            if (filterType === 'positive') {
                exportCsvBtnLabel.textContent = 'Export Positive (.csv)';
            } else if (filterType === 'negative') {
                exportCsvBtnLabel.textContent = 'Export Negative (.csv)';
            } else if (filterType === 'neutral') {
                exportCsvBtnLabel.textContent = 'Export Neutral (.csv)';
            } else {
                exportCsvBtnLabel.textContent = 'Export All (.csv)';
            }
        }

        filterAndRenderExplorer();

        if (shouldScroll && reviewExplorerSection && !reviewExplorerSection.classList.contains('hidden')) {
            reviewExplorerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    expTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filterType = btn.getAttribute('data-filter');
            setExplorerFilter(filterType, false);
        });
    });

    explorerSearchInput.addEventListener('input', () => {
        currentSearchTerm = explorerSearchInput.value.toLowerCase().trim();
        filterAndRenderExplorer();
    });

    // Keyboard shortcut: Escape clears review search
    explorerSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            explorerSearchInput.value = '';
            currentSearchTerm = '';
            filterAndRenderExplorer();
        }
    });

    // Interactive KPI Filter Cards
    const kpiCards = document.querySelectorAll('.kpi-card');
    kpiCards.forEach(card => {
        card.addEventListener('click', () => {
            const filterType = card.getAttribute('data-filter');
            if (!filterType) return;
            setExplorerFilter(filterType, true);
        });
    });

    // Segmented Progress Bar & Legend Clickable Segments
    if (segPosBar) {
        segPosBar.addEventListener('click', () => setExplorerFilter('positive', true));
        segPosBar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setExplorerFilter('positive', true);
            }
        });
    }

    if (segNegBar) {
        segNegBar.addEventListener('click', () => setExplorerFilter('negative', true));
        segNegBar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setExplorerFilter('negative', true);
            }
        });
    }

    if (segNeuBar) {
        segNeuBar.addEventListener('click', () => setExplorerFilter('neutral', true));
        segNeuBar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setExplorerFilter('neutral', true);
            }
        });
    }

    if (legendPosItem) {
        legendPosItem.addEventListener('click', () => setExplorerFilter('positive', true));
    }
    if (legendNegItem) {
        legendNegItem.addEventListener('click', () => setExplorerFilter('negative', true));
    }
    if (legendNeuItem) {
        legendNeuItem.addEventListener('click', () => setExplorerFilter('neutral', true));
    }

    // Interactive Hover/Scrub Polarity Meter
    const meterTrack = document.getElementById('meterTrack');
    const meterTooltipEl = document.getElementById('meterTooltip');
    if (meterTrack && meterTooltipEl) {
        meterTrack.addEventListener('mousemove', (e) => {
            const rect = meterTrack.getBoundingClientRect();
            const mouseX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const pct = mouseX / rect.width;
            const score = (pct * 2 - 1).toFixed(2);
            let label = 'Neutral';
            if (score >= 0.05) label = 'Positive';
            else if (score <= -0.05) label = 'Negative';

            meterTooltipEl.style.left = `${mouseX}px`;
            meterTooltipEl.textContent = `Score: ${score > 0 ? '+' : ''}${score} (${label})`;
        });

        meterTrack.addEventListener('mouseleave', () => {
            const currentScore = parseFloat(compoundValue.textContent) || 0;
            const pct = Math.min(Math.max(((currentScore + 1) / 2) * 100, 2), 98);
            meterTooltipEl.style.left = `${pct}%`;
            let label = currentScore >= 0.05 ? 'Positive' : (currentScore <= -0.05 ? 'Negative' : 'Neutral');
            meterTooltipEl.textContent = `Score: ${(currentScore > 0 ? '+' : '') + currentScore.toFixed(2)} (${label})`;
        });
    }

    function filterAndRenderExplorer() {
        let filtered = activeBatchReviews;

        if (currentFilter !== 'all') {
            filtered = filtered.filter(r => r.sentiment === currentFilter);
        }

        if (currentSearchTerm) {
            filtered = filtered.filter(r => r.text.toLowerCase().includes(currentSearchTerm));
        }

        explorerCountText.textContent = `Showing ${filtered.length.toLocaleString()} of ${activeBatchReviews.length.toLocaleString()} entries`;

        explorerReviewsList.innerHTML = '';

        if (filtered.length === 0) {
            explorerReviewsList.innerHTML = `
                <div class="empty-reviews-state">
                    No entries match the selected filter or search term.
                </div>
            `;
            return;
        }

        // Render first 150 items with clean typography, copy buttons, and expand toggle using DocumentFragment
        const displayList = filtered.slice(0, 150);
        const fragment = document.createDocumentFragment();

        displayList.forEach((r, idx) => {
            const card = document.createElement('div');
            const cardClass = r.sentiment === 'positive' ? 'card-pos' : (r.sentiment === 'negative' ? 'card-neg' : 'card-neu');
            const badgeClass = r.sentiment === 'positive' ? 'badge-pos' : (r.sentiment === 'negative' ? 'badge-neg' : 'badge-neu');

            card.className = `review-card ${cardClass}`;
            card.style.animationDelay = `${Math.min(idx * 25, 350)}ms`;

            const isLong = r.text.length > 200;
            const highlightedFull = formatHighlightedText(r.text, currentSearchTerm);
            const truncatedSnippet = isLong ? formatHighlightedText(r.text.slice(0, 180) + '...', currentSearchTerm) : highlightedFull;

            card.innerHTML = `
                <div class="review-card-header">
                    <span class="rev-id">Entry #${r.id}</span>
                    <div class="rev-header-actions">
                        <span class="rev-badge ${badgeClass}">${r.sentiment} (${r.compound > 0 ? '+' : ''}${r.compound.toFixed(2)})</span>
                        <button type="button" class="rev-copy-btn" title="Copy text">📋 Copy</button>
                    </div>
                </div>
                <p class="rev-text">${isLong ? truncatedSnippet : highlightedFull}</p>
                ${isLong ? `<button type="button" class="rev-expand-btn" data-expanded="false">Show more</button>` : ''}
            `;

            // Wire up copy button
            const copyBtn = card.querySelector('.rev-copy-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    copyReviewText(r.text, copyBtn);
                });
            }

            // Wire up expand / collapse toggle
            const expandBtn = card.querySelector('.rev-expand-btn');
            if (expandBtn) {
                expandBtn.addEventListener('click', () => {
                    const isExpanded = expandBtn.getAttribute('data-expanded') === 'true';
                    const textP = card.querySelector('.rev-text');
                    if (isExpanded) {
                        textP.innerHTML = truncatedSnippet;
                        expandBtn.textContent = 'Show more';
                        expandBtn.setAttribute('data-expanded', 'false');
                    } else {
                        textP.innerHTML = highlightedFull;
                        expandBtn.textContent = 'Show less';
                        expandBtn.setAttribute('data-expanded', 'true');
                    }
                });
            }

            fragment.appendChild(card);
        });

        if (filtered.length > 150) {
            const moreNote = document.createElement('div');
            moreNote.className = 'empty-reviews-state';
            moreNote.textContent = `...and ${filtered.length - 150} more reviews. Use search or export to CSV to inspect all.`;
            fragment.appendChild(moreNote);
        }

        explorerReviewsList.appendChild(fragment);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ==========================================
    // Export Reviews & Segment Downloads to CSV
    // ==========================================
    function triggerReviewsCsvDownload(reviews, defaultFilename, triggerBtn = null) {
        if (!reviews || reviews.length === 0) {
            alert('No text records available in this category to download.');
            return;
        }

        // Add UTF-8 BOM so spreadsheet apps (Excel, Sheets) render special characters and accents perfectly
        let csvContent = "\uFEFFID,Sentiment,Compound Score,Positive Score,Neutral Score,Negative Score,Text Content\n";

        reviews.forEach(r => {
            const cleanText = `"${String(r.text || '').replace(/"/g, '""')}"`;
            const comp = typeof r.compound === 'number' ? (r.compound > 0 ? `+${r.compound.toFixed(2)}` : r.compound.toFixed(2)) : r.compound;
            const pos = r.pos !== undefined ? `${r.pos}%` : '0%';
            const neu = r.neu !== undefined ? `${r.neu}%` : '0%';
            const neg = r.neg !== undefined ? `${r.neg}%` : '0%';
            csvContent += `${r.id},${r.sentiment},${comp},${pos},${neu},${neg},${cleanText}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', defaultFilename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        // Tactile interactive button feedback
        if (triggerBtn) {
            triggerBtn.classList.add('btn-dl-success');
            const spanEl = triggerBtn.querySelector('span');
            const originalText = spanEl ? spanEl.textContent : triggerBtn.textContent;
            if (spanEl) {
                spanEl.textContent = '✓ Downloaded!';
            }
            setTimeout(() => {
                triggerBtn.classList.remove('btn-dl-success');
                if (spanEl) {
                    spanEl.textContent = originalText;
                }
            }, 1800);
        }
    }

    function downloadPositiveReviews(btn = null) {
        if (!activeBatchReviews || activeBatchReviews.length === 0) {
            alert('No records available to export. Please analyze a document first.');
            return;
        }
        const positiveItems = activeBatchReviews.filter(r => r.sentiment === 'positive');
        if (positiveItems.length === 0) {
            alert('No positive text records found in this document.');
            return;
        }
        const dateStr = new Date().toISOString().slice(0, 10);
        triggerReviewsCsvDownload(positiveItems, `positive_texts_${dateStr}.csv`, btn);
    }

    function downloadNegativeReviews(btn = null) {
        if (!activeBatchReviews || activeBatchReviews.length === 0) {
            alert('No records available to export. Please analyze a document first.');
            return;
        }
        const negativeItems = activeBatchReviews.filter(r => r.sentiment === 'negative');
        if (negativeItems.length === 0) {
            alert('No negative text records found in this document.');
            return;
        }
        const dateStr = new Date().toISOString().slice(0, 10);
        triggerReviewsCsvDownload(negativeItems, `negative_texts_${dateStr}.csv`, btn);
    }

    // Top Highlights Download Buttons
    if (downloadPosHighlightsBtn) {
        downloadPosHighlightsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadPositiveReviews(downloadPosHighlightsBtn);
        });
    }

    if (downloadNegHighlightsBtn) {
        downloadNegHighlightsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadNegativeReviews(downloadNegHighlightsBtn);
        });
    }

    // Segmented Bar Quick Download Buttons
    if (quickDlPosBtn) {
        quickDlPosBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadPositiveReviews(quickDlPosBtn);
        });
    }

    if (quickDlNegBtn) {
        quickDlNegBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadNegativeReviews(quickDlNegBtn);
        });
    }

    // Explorer Header Dedicated Segment Download Buttons
    if (downloadPosExplorerBtn) {
        downloadPosExplorerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadPositiveReviews(downloadPosExplorerBtn);
        });
    }

    if (downloadNegExplorerBtn) {
        downloadNegExplorerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadNegativeReviews(downloadNegExplorerBtn);
        });
    }

    // Context-Aware Main Export Button
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            if (!activeBatchReviews || activeBatchReviews.length === 0) {
                alert('No text records available to export.');
                return;
            }

            const dateStr = new Date().toISOString().slice(0, 10);

            if (currentFilter === 'positive') {
                downloadPositiveReviews(exportCsvBtn);
            } else if (currentFilter === 'negative') {
                downloadNegativeReviews(exportCsvBtn);
            } else if (currentFilter === 'neutral') {
                const neutralItems = activeBatchReviews.filter(r => r.sentiment === 'neutral');
                if (neutralItems.length === 0) {
                    alert('No neutral text records found in this document.');
                    return;
                }
                triggerReviewsCsvDownload(neutralItems, `neutral_texts_${dateStr}.csv`, exportCsvBtn);
            } else {
                // If search term is present, export filtered results
                if (currentSearchTerm) {
                    const searchFiltered = activeBatchReviews.filter(r => r.text.toLowerCase().includes(currentSearchTerm));
                    triggerReviewsCsvDownload(searchFiltered, `filtered_search_texts_${dateStr}.csv`, exportCsvBtn);
                } else {
                    triggerReviewsCsvDownload(activeBatchReviews, `all_sentiment_records_${dateStr}.csv`, exportCsvBtn);
                }
            }
        });
    }

    function renderDrivers(container, wordList, tagClass) {
        container.innerHTML = '';

        if (!wordList || wordList.length === 0) {
            const emptySpan = document.createElement('span');
            emptySpan.className = 'empty-tag';
            emptySpan.textContent = 'None detected';
            container.appendChild(emptySpan);
            return;
        }

        wordList.forEach(item => {
            const tag = document.createElement('span');
            tag.className = `tag ${tagClass}`;
            tag.textContent = `${item.word} (${item.score > 0 ? '+' : ''}${item.score.toFixed(2)})`;
            tag.title = `Click to filter entries mentioning "${item.word}"`;
            
            // Interactive keyword filtering
            tag.addEventListener('click', () => {
                if (reviewExplorerSection && !reviewExplorerSection.classList.contains('hidden')) {
                    explorerSearchInput.value = item.word;
                    currentSearchTerm = item.word.toLowerCase();
                    filterAndRenderExplorer();
                    reviewExplorerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });

            container.appendChild(tag);
        });
    }

    // ==========================================
    // 1-Click Sample Reviews Spreadsheet Loader
    // ==========================================
    const loadSampleDocBtn = document.getElementById('loadSampleDocBtn');
    if (loadSampleDocBtn) {
        loadSampleDocBtn.addEventListener('click', () => {
            const sampleCsv = `Review_ID,Customer_Name,Review_Date,Star_Rating,Customer_Feedback,Product_Category
1001,Alice Smith,2026-03-01,5,"The battery life on this device is genuinely phenomenal! Lasts two whole days on a single charge and charges very quickly.",Electronics
1002,Bob Miller,2026-03-02,1,"Terrible customer support. The package arrived damaged and they refused to issue a refund or replacement. Avoid at all costs!",Electronics
1003,Charlie Chen,2026-03-03,4,"Solid build quality and clean minimalist design. Works smoothly with all my peripherals without any setup hassle.",Computers
1004,Diana Prince,2026-03-04,1,"Completely stopped working after 3 days. Software is riddled with annoying bugs and crashes constantly. Very disappointed.",Electronics
1005,Evan Wright,2026-03-05,5,"Outstanding experience! Delivery was lightning fast and the product exceeded all my expectations. Highly recommended!",Home
1006,Fiona Gallagher,2026-03-06,3,"Average performance for the price. It gets the job done but materials feel a bit cheap.",Accessories
1007,George Clark,2026-03-07,5,"Pure delight to use! Sleek aesthetic, intuitive controls, and seamless sync across all my devices.",Electronics
1008,Hannah Abbott,2026-03-08,2,"The screen flickers intermittently under bright light. Reached out to support and waiting for resolution.",Computers
1009,Ian Malcolm,2026-03-09,5,"Top-notch quality and incredible attention to detail. This is easily the best purchase I made this year.",Electronics
1010,Julia Roberts,2026-03-10,1,"Worst shopping experience ever. Defective hardware on arrival and completely unhelpful customer service.",Accessories`;

            const blob = new Blob([sampleCsv], { type: 'text/csv' });
            const sampleFile = new File([blob], 'customer_feedback_sample.csv', { type: 'text/csv' });
            handleFileUpload(sampleFile);
        });
    }

    // ==========================================
    // Left-to-Right Hero Typewriter Typography Effect
    // ==========================================
    const typedPhrase = document.getElementById('typedPhrase');
    if (typedPhrase) {
        const phrases = [
            "in text, documents & feedback",
            "in spreadsheets & CSVs",
            "in customer feedback",
            "in PDF & Word documents",
            "in support tickets",
            "in seconds"
        ];
        let phraseIdx = 0;
        let charIdx = phrases[0].length;
        let isDeleting = false;

        function runTypewriter() {
            const current = phrases[phraseIdx];
            if (isDeleting) {
                charIdx--;
                typedPhrase.textContent = current.substring(0, charIdx);
            } else {
                charIdx++;
                typedPhrase.textContent = current.substring(0, charIdx);
            }

            let delay = isDeleting ? 40 : 80;

            if (!isDeleting && charIdx === current.length) {
                delay = 2400; // Pause when word completed
                isDeleting = true;
            } else if (isDeleting && charIdx === 0) {
                isDeleting = false;
                phraseIdx = (phraseIdx + 1) % phrases.length;
                delay = 400; // Pause before typing new word
            }

            setTimeout(runTypewriter, delay);
        }

        setTimeout(runTypewriter, 2000);
    }

    // ==========================================
    // Light / Dark Theme Controller
    // ==========================================
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeLabelText = document.getElementById('themeLabelText');

    function updateThemeUI(theme) {
        const isDark = theme === 'dark';
        if (themeToggleBtn) {
            themeToggleBtn.setAttribute('aria-checked', isDark ? 'true' : 'false');
            themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
            themeToggleBtn.classList.toggle('is-dark', isDark);
        }
        if (themeLabelText) {
            themeLabelText.textContent = isDark ? 'Light' : 'Dark';
        }
    }

    if (themeToggleBtn) {
        const initialTheme = document.documentElement.getAttribute('data-theme') || 'light';
        updateThemeUI(initialTheme);

        themeToggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const target = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', target);
            try {
                localStorage.setItem('sentimind-theme', target);
            } catch (err) {
                console.warn('Unable to persist theme to localStorage', err);
            }
            updateThemeUI(target);
        });
    }



    // ==========================================
    // Interactive Glass Card Spotlight Reflection
    // ==========================================
    document.querySelectorAll('.glass-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
});
