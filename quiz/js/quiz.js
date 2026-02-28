/**
 * Malaysia Postal Code Prefix Quiz
 * quiz/js/quiz.js
 */

(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────────────
  const state = {
    map: null,
    geojsonLayer: null,
    questions: [],
    currentIndex: 0,
    score: 0,
    mode: 'state',        // 'state' | 'prefix'
    timerEnabled: false,
    timerSeconds: 15,
    timerRemaining: 0,
    timerInterval: null,
    locked: false,        // prevent clicks during feedback
    answeredStates: new Set(),
  };

  // ─── Map style helpers ───────────────────────────────────────────────────────
  const STYLE_DEFAULT  = { fillColor: '#c8d8e8', color: '#4a6a8a', weight: 1.5, fillOpacity: 0.5 };
  const STYLE_HOVER    = { fillColor: '#9fb8d0', color: '#2a4a6a', weight: 2,   fillOpacity: 0.7 };
  const STYLE_CORRECT  = { fillColor: '#4CAF50', color: '#2e7d32', weight: 2.5, fillOpacity: 0.75 };
  const STYLE_INCORRECT = { fillColor: '#f44336', color: '#b71c1c', weight: 2.5, fillOpacity: 0.75 };

  // ─── DOM helpers ─────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = $(id);
    el.classList.add('active');
    el.classList.remove('screen-enter');
    void el.offsetWidth; // trigger reflow
    el.classList.add('screen-enter');
  }

  // ─── Init map ────────────────────────────────────────────────────────────────
  function initMap() {
    if (state.map) return;

    state.map = L.map('map', {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    });

    // Fit to Malaysia's bounding box (both Peninsular and Borneo)
    const malaysiaFit = [[0.85, 99.6], [7.35, 119.3]];
    state.map.fitBounds(malaysiaFit);

    // Light tile layer (optional, falls back gracefully if offline)
    try {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 10,
        minZoom: 4,
      }).addTo(state.map);
    } catch (_) { /* map still works without tiles */ }
  }

  // ─── Load GeoJSON ────────────────────────────────────────────────────────────
  async function loadGeoJSON() {
    const resp = await fetch('data/malaysia.geojson');
    if (!resp.ok) throw new Error('Failed to load GeoJSON');
    return resp.json();
  }

  function buildGeoJSONLayer(geojsonData) {
    if (state.geojsonLayer) {
      state.map.removeLayer(state.geojsonLayer);
    }

    state.geojsonLayer = L.geoJSON(geojsonData, {
      style: STYLE_DEFAULT,
      onEachFeature: (feature, layer) => {
        const stateName = feature.properties.name;

        // Tooltip
        layer.bindTooltip(stateName, {
          permanent: false,
          direction: 'auto',
          className: 'state-tooltip',
          sticky: true,
        });

        // Hover effects
        layer.on('mouseover', () => {
          if (!state.locked && !state.answeredStates.has(stateName)) {
            layer.setStyle(STYLE_HOVER);
          }
          layer.getTooltip() && layer.openTooltip();
        });

        layer.on('mouseout', () => {
          if (!state.locked && !state.answeredStates.has(stateName)) {
            layer.setStyle(STYLE_DEFAULT);
          }
        });

        // Click
        layer.on('click', () => handleAnswer(stateName, layer));

        layer.options._stateName = stateName;
      }
    }).addTo(state.map);
  }

  // ─── Question generation ─────────────────────────────────────────────────────
  function buildQuestions() {
    if (state.mode === 'state') {
      // One question per state — show one representative prefix
      return ALL_STATES.map(st => {
        const prefixes = POSTAL_DATA[st];
        return {
          prefix: prefixes[0], // first prefix as representative
          state: st,
          allPrefixes: prefixes,
        };
      });
    } else {
      // One question per prefix
      return ALL_PREFIXES.map(pfx => ({
        prefix: pfx,
        state: PREFIX_TO_STATE[pfx],
        allPrefixes: POSTAL_DATA[PREFIX_TO_STATE[pfx]],
      }));
    }
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ─── Quiz flow ───────────────────────────────────────────────────────────────
  function startQuiz() {
    state.mode = $('mode-state').checked ? 'state' : 'prefix';
    state.timerEnabled = $('timer-toggle').checked;
    state.score = 0;
    state.currentIndex = 0;
    state.locked = false;
    state.answeredStates = new Set();
    state.questions = shuffle(buildQuestions());

    resetAllStyles();
    showScreen('quiz-screen');

    // Small delay to ensure screen is fully visible before asking question
    setTimeout(loadQuestion, 100);
  }

  function loadQuestion() {
    if (state.currentIndex >= state.questions.length) {
      showEndScreen();
      return;
    }

    stopTimer();
    state.locked = false;
    resetAllStyles();

    const q = state.questions[state.currentIndex];

    // Update UI
    $('prefix-display').textContent = q.prefix;
    $('score-display').textContent = `${state.score} / ${state.questions.length}`;
    updateProgress();
    hideFeedback();

    // Timer
    if (state.timerEnabled) {
      startTimer();
    } else {
      $('timer-display').textContent = '';
    }
  }

  function handleAnswer(clickedState, clickedLayer) {
    if (state.locked) return;
    state.locked = true;
    stopTimer();

    const q = state.questions[state.currentIndex];
    const isCorrect = clickedState === q.state;

    if (isCorrect) {
      state.score++;
      clickedLayer.setStyle(STYLE_CORRECT);
      showFeedback('correct', `✓ Correct! ${clickedState}`);
      state.answeredStates.add(clickedState);
    } else {
      clickedLayer.setStyle(STYLE_INCORRECT);

      // Find and highlight the correct layer
      const correctLayer = findLayerByState(q.state);
      if (correctLayer) {
        correctLayer.setStyle(STYLE_CORRECT);
        state.answeredStates.add(q.state);
      }

      showFeedback('incorrect', `✗ It was: ${q.state}`);
      state.answeredStates.add(clickedState);
    }

    $('score-display').textContent = `${state.score} / ${state.questions.length}`;

    setTimeout(() => {
      state.currentIndex++;
      loadQuestion();
    }, isCorrect ? 1200 : 2200);
  }

  function findLayerByState(stateName) {
    let found = null;
    state.geojsonLayer.eachLayer(layer => {
      if (layer.feature && layer.feature.properties.name === stateName) {
        found = layer;
      }
    });
    return found;
  }

  function resetAllStyles() {
    if (!state.geojsonLayer) return;
    state.geojsonLayer.eachLayer(layer => {
      layer.setStyle(STYLE_DEFAULT);
    });
    state.answeredStates = new Set();
  }

  // ─── Progress & feedback ─────────────────────────────────────────────────────
  function updateProgress() {
    const total = state.questions.length;
    const pct = total > 0 ? (state.currentIndex / total) * 100 : 0;
    $('progress-bar').style.width = pct + '%';
    $('progress-label').textContent = `Question ${state.currentIndex + 1} of ${total}`;
  }

  function showFeedback(type, msg) {
    const el = $('feedback-message');
    el.textContent = msg;
    el.className = `feedback-message ${type} show`;
  }

  function hideFeedback() {
    const el = $('feedback-message');
    el.className = 'feedback-message';
    el.textContent = '';
  }

  // ─── Timer ───────────────────────────────────────────────────────────────────
  function startTimer() {
    state.timerRemaining = state.timerSeconds;
    updateTimerDisplay();

    state.timerInterval = setInterval(() => {
      state.timerRemaining--;
      updateTimerDisplay();

      if (state.timerRemaining <= 0) {
        stopTimer();
        if (!state.locked) {
          // Time's up — treat as incorrect
          state.locked = true;
          const q = state.questions[state.currentIndex];
          const correctLayer = findLayerByState(q.state);
          if (correctLayer) {
            correctLayer.setStyle(STYLE_CORRECT);
          }
          showFeedback('incorrect', `⏱ Time's up! It was: ${q.state}`);
          setTimeout(() => {
            state.currentIndex++;
            loadQuestion();
          }, 2200);
        }
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  function updateTimerDisplay() {
    const el = $('timer-display');
    if (!state.timerEnabled) {
      el.textContent = '';
      return;
    }
    el.textContent = `${state.timerRemaining}s`;
    el.classList.toggle('warning', state.timerRemaining <= 5);
  }

  // ─── End screen ──────────────────────────────────────────────────────────────
  function showEndScreen() {
    stopTimer();
    const total = state.questions.length;
    const pct = total > 0 ? Math.round((state.score / total) * 100) : 0;

    $('final-score').textContent = `${state.score} / ${total}`;
    $('final-pct').textContent = `${pct}%`;

    let icon = '😊';
    let subtitle = 'Good effort!';
    if (pct === 100) { icon = '🏆'; subtitle = 'Perfect score! Excellent!'; }
    else if (pct >= 80) { icon = '🌟'; subtitle = 'Great job!'; }
    else if (pct >= 60) { icon = '👍'; subtitle = 'Not bad!'; }
    else if (pct < 40) { icon = '📚'; subtitle = 'Keep practising!'; }

    $('result-icon').textContent = icon;
    $('result-subtitle').textContent = subtitle;

    showScreen('end-screen');
  }

  // ─── Option card selection UX ────────────────────────────────────────────────
  function setupOptionCards() {
    document.querySelectorAll('.option-card').forEach(card => {
      const radio = card.querySelector('input[type="radio"]');
      card.addEventListener('click', () => {
        // Deselect siblings
        document.querySelectorAll(`.option-card`).forEach(c => {
          if (c.querySelector('input[name="' + radio.name + '"]')) {
            c.classList.remove('selected');
          }
        });
        radio.checked = true;
        card.classList.add('selected');
      });
    });
  }

  // ─── Bootstrap ───────────────────────────────────────────────────────────────
  async function init() {
    setupOptionCards();

    // Start button
    $('btn-start').addEventListener('click', () => {
      initMap();
      // Load GeoJSON if not yet done
      if (!state.geojsonLayer) {
        loadGeoJSON()
          .then(data => {
            buildGeoJSONLayer(data);
            startQuiz();
          })
          .catch(err => {
            console.error('Failed to load GeoJSON:', err);
            alert('Failed to load map data. Please try again.');
          });
      } else {
        startQuiz();
      }
    });

    // Replay button (same settings)
    $('btn-replay').addEventListener('click', () => {
      showScreen('quiz-screen');
      startQuiz();
    });

    // Home button
    $('btn-home').addEventListener('click', () => {
      showScreen('start-screen');
    });

    // Show start screen
    showScreen('start-screen');
  }

  document.addEventListener('DOMContentLoaded', init);

})();
