/**
 * MTS Cinematic Percussion Trainer
 * mts-percussion.js — embeddable module
 *
 * Usage:
 *   MTSPercussion.init({
 *     container:  '#trainer',          // CSS selector or DOM element
 *     lessonId:   '1-1',               // which lesson to load (optional)
 *     audioBase:  'https://assets.masterthescore.com/percussion/', // sample URL base
 *     onSave:     (id, score, done) => { ... }, // Outseta / localStorage callback
 *     curriculum: [...],               // override default curriculum (optional)
 *   });
 *
 * Sample files expected at audioBase:
 *   low.mp3, mid.mp3, high.mp3, accent.mp3
 *   (falls back to Web Audio synthesis if files not found)
 *
 * MIDI Export:
 *   MTSPercussion.exportMIDI()  — downloads student pattern as .mid
 */

(function(global) {
'use strict';

// ─────────────────────────────────────────────
// DEFAULT CURRICULUM
// Add / edit lessons here. audioBase + vid = Spotlightr ID.
// ─────────────────────────────────────────────
const DEFAULT_CURRICULUM = [
  { id:'1-1', title:'Bass Drum Foundation', level:1, rows:['low'],
    bpm:80, subdiv:8, bars:1, vid:'SPOT_ID_1_1', unlock:80, pass:70,
    pat:{ low:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0] },
    vel:{ low:[.9,0,0,0,.75,0,0,0,.85,0,0,0,.8,0,0,0] }},
  { id:'1-2', title:'Hi-Hat Groove', level:1, rows:['high'],
    bpm:85, subdiv:8, bars:1, vid:'SPOT_ID_1_2', unlock:80, pass:70,
    pat:{ high:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] },
    vel:{ high:[.7,0,.6,0,.72,0,.6,0,.7,0,.6,0,.72,0,.6,0] }},
  { id:'1-3', title:'The Backbeat', level:1, rows:['low','mid','high'],
    bpm:90, subdiv:8, bars:1, vid:'SPOT_ID_1_3', unlock:80, pass:70,
    pat:{ low:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
          mid:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
          high:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] },
    vel:{ low:[.9,0,0,0,.7,0,0,0,.88,0,0,0,.7,0,0,0],
          mid:[0,0,0,0,.82,0,0,0,0,0,0,0,.85,0,0,0],
          high:[.62,0,.54,0,.64,0,.54,0,.62,0,.54,0,.64,0,.54,0] }},
  { id:'2-1', title:'Cinematic Groove', level:2, rows:['low','mid','high'],
    bpm:100, subdiv:16, bars:1, vid:'SPOT_ID_2_1', unlock:80, pass:70,
    pat:{ low:[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
          mid:[0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
          high:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] },
    vel:{ low:[.92,0,0,0,0,0,0,0,.78,0,0,0,0,0,0,0],
          mid:[0,0,0,0,0,0,0,0,0,0,0,0,.82,0,0,0],
          high:[.65,0,.52,0,.62,0,.52,0,.65,0,.52,0,.62,0,.52,0] }},
  { id:'2-2', title:'Snare Backbeat', level:2, rows:['low','mid','high'],
    bpm:95, subdiv:8, bars:1, vid:'SPOT_ID_2_2', unlock:80, pass:70,
    pat:{ low:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
          mid:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
          high:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] },
    vel:{ low:[.9,0,0,0,.7,0,0,0,.88,0,0,0,.7,0,0,0],
          mid:[0,0,0,0,.82,0,0,0,0,0,0,0,.85,0,0,0],
          high:[.62,0,.54,0,.64,0,.54,0,.62,0,.54,0,.64,0,.54,0] }},
  { id:'3-1', title:'Full Cinematic Hit', level:3, rows:['low','mid','high','accent'],
    bpm:108, subdiv:16, bars:1, vid:'SPOT_ID_3_1', unlock:80, pass:70,
    pat:{ low:[1,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0],
          mid:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
          high:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
          accent:[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    vel:{ low:[.95,0,0,0,0,0,.7,0,.82,0,0,0,0,0,0,0],
          mid:[0,0,0,0,.78,0,0,0,0,0,0,0,.85,0,0,0],
          high:[.6,0,.5,0,.62,0,.5,0,.6,0,.5,0,.62,0,.5,0],
          accent:[.98,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] }},
];

const ROWS = [
  {id:'low',   name:'LOW',   sub:'Bass Drum', color:'#b86a44'},
  {id:'mid',   name:'MID',   sub:'Snare',     color:'#c2a667'},
  {id:'high',  name:'HIGH',  sub:'Hi-Hat',    color:'#7d96a4'},
  {id:'accent',name:'ACCENT',sub:'Impact',    color:'#d6cbb0'},
];

const SDLBL = {4:'♩ Quarter',8:'♪ 8th',16:'♬ 16th',32:'♬♬ 32nd',12:'♩³ Triplet',24:'♬³ Triplet'};

// ─────────────────────────────────────────────
// MODULE STATE
// ─────────────────────────────────────────────
let _config   = {};
let _cur      = null;
let _arows    = [];
let _refSt    = {};
let _stuSt    = {};
let _bpmV     = 80;
let _checkM   = 'rhythm';
let _playCt   = 0;
let _phase    = 'watch';
let _vidPct   = 0;
let _simIv    = null;
let _simP     = 0;
let _actx     = null;
let _pbCtx    = null;
let _buffers  = {};   // loaded audio buffers keyed by row id
let _root     = null; // container DOM element
let _CUR      = [];   // active curriculum

// ─────────────────────────────────────────────
// PROGRESS — localStorage with onSave hook
// ─────────────────────────────────────────────
function _saveProg(id, score, done) {
  // localStorage fallback
  try {
    localStorage.setItem('mts_p_' + id + '_s', score);
    if (done) localStorage.setItem('mts_p_' + id + '_d', '1');
  } catch(e) {}
  // ⚡ OUTSETA HOOK — fires if provided in config
  // Replace localStorage above with Outseta API call:
  //   fetch('https://YOUR.outseta.com/crm/people/current', {
  //     method: 'PUT',
  //     headers: { Authorization: 'Bearer ' + Outseta.getAccessToken(),
  //                'Content-Type': 'application/json' },
  //     body: JSON.stringify({ ['perc_'+id+'_score']: score,
  //                            ['perc_'+id+'_done']: done })
  //   });
  if (typeof _config.onSave === 'function') {
    _config.onSave(id, score, done);
  }
}

function _getProg(id) {
  try {
    return {
      score: parseInt(localStorage.getItem('mts_p_' + id + '_s') || '0'),
      done:  localStorage.getItem('mts_p_' + id + '_d') === '1'
    };
  } catch(e) { return {score:0, done:false}; }
}

function _unlocked(idx) {
  return idx === 0 || _getProg(_CUR[idx-1].id).done;
}

// ─────────────────────────────────────────────
// AUDIO ENGINE
// Loads samples from audioBase if provided, falls back to synthesis
// ─────────────────────────────────────────────
function _iAudio() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  if (_actx.state === 'suspended') _actx.resume();
}

async function _loadSamples() {
  if (!_config.audioBase) return;
  _iAudio();
  const files = { low:'low.mp3', mid:'mid.mp3', high:'high.mp3', accent:'accent.mp3' };
  for (const [id, file] of Object.entries(files)) {
    try {
      const res = await fetch(_config.audioBase.replace(/\/$/, '') + '/' + file);
      if (!res.ok) continue;
      const arr = await res.arrayBuffer();
      _buffers[id] = await _actx.decodeAudioData(arr);
    } catch(e) {
      // silently fall back to synthesis
    }
  }
}

function _playSample(rowId, vel) {
  const buf = _buffers[rowId];
  if (!buf) return false;
  const src = _actx.createBufferSource();
  src.buffer = buf;
  const g = _actx.createGain();
  g.gain.setValueAtTime(vel * 0.85, _actx.currentTime);
  src.connect(g);
  g.connect(_actx.destination);
  src.start(_actx.currentTime);
  return true;
}

function _drum(rowId, vel) {
  _iAudio();
  if (_playSample(rowId, vel)) return;
  // Synthesis fallback
  const ri = ROWS.findIndex(function(r) { return r.id === rowId; });
  const now = _actx.currentTime;
  const g = _actx.createGain();
  g.connect(_actx.destination);
  g.gain.setValueAtTime(vel * 0.72, now);
  if (ri === 0) {
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    const b = _actx.createBuffer(1, _actx.sampleRate * 0.5, _actx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/d.length, 3);
    const s = _actx.createBufferSource(); s.buffer = b;
    const f = _actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 115;
    s.connect(f); f.connect(g); s.start(now);
    const o = _actx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(55, now); o.frequency.exponentialRampToValueAtTime(28, now+0.9);
    o.connect(g); o.start(now); o.stop(now+1);
  } else if (ri === 1) {
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    const b = _actx.createBuffer(1, _actx.sampleRate * 0.3, _actx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/d.length, 2);
    const s = _actx.createBufferSource(); s.buffer = b;
    const f = _actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 240; f.Q.value = 1.5;
    s.connect(f); f.connect(g); s.start(now);
  } else if (ri === 2) {
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    const b = _actx.createBuffer(1, _actx.sampleRate * 0.12, _actx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/d.length, 5);
    const s = _actx.createBufferSource(); s.buffer = b;
    const f = _actx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    s.connect(f); f.connect(g); s.start(now);
  } else {
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.65);
    const o = _actx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(80, now); o.frequency.exponentialRampToValueAtTime(20, now+1.65);
    o.connect(g); o.start(now); o.stop(now+1.8);
  }
}

// ─────────────────────────────────────────────
// PLAYBACK ENGINE
// ─────────────────────────────────────────────
function _hlS(tgt, prev, c) {
  _arows.forEach(function(r) {
    if (prev >= 0) { var e = _root.querySelector('#' + tgt + '-c-' + r.id + '-' + prev); if (e) e.classList.remove('ph'); }
    if (c    >= 0) { var e = _root.querySelector('#' + tgt + '-c-' + r.id + '-' + c);    if (e) e.classList.add('ph'); }
  });
}

function _stopPb() {
  if (!_pbCtx) return;
  clearTimeout(_pbCtx.t);
  _hlS(_pbCtx.tgt, _pbCtx.s, -1);
  _pbCtx = null;
}

function _startPb(tgt, st, loop, onEnd) {
  _stopPb();
  _iAudio();
  var n = _cur.subdiv * _cur.bars, sd = _cur.subdiv;
  _pbCtx = {tgt: tgt, t: null, s: -1};
  function tick() {
    var p = _pbCtx.s;
    _pbCtx.s = (_pbCtx.s + 1) % n;
    _hlS(tgt, p, _pbCtx.s);
    _arows.forEach(function(r) {
      var s = st[r.id] && st[r.id][_pbCtx.s];
      if (s && s.on) _drum(r.id, s.vel || 0.75);
    });
    var iv = (60 / _bpmV) / (sd / 4) * 1000;
    if (_pbCtx.s === n - 1) {
      _pbCtx.t = setTimeout(function() {
        _hlS(tgt, _pbCtx.s, -1); _pbCtx.s = -1;
        if (loop) { tick(); } else { var cb = onEnd; _pbCtx = null; if (cb) cb(); }
      }, iv);
    } else { _pbCtx.t = setTimeout(tick, iv); }
  }
  tick();
}

// ─────────────────────────────────────────────
// MIDI EXPORT
// Exports student pattern as Standard MIDI File (format 0)
// ─────────────────────────────────────────────
function _exportMIDI() {
  var MIDI_NOTE = {low: 36, mid: 38, high: 42, accent: 49}; // GM Drum Map
  var n = _cur.subdiv * _cur.bars;
  var ppq = 480; // ticks per quarter note
  var ticksPerStep = ppq / (_cur.subdiv / 4);
  var tempo = Math.round(60000000 / _bpmV); // microseconds per beat

  // Track events: array of [tick, [bytes]]
  var events = [];

  // Tempo event
  events.push([0, [0xFF, 0x51, 0x03,
    (tempo >> 16) & 0xFF, (tempo >> 8) & 0xFF, tempo & 0xFF]]);

  _arows.forEach(function(row) {
    var note = MIDI_NOTE[row.id] || 38;
    for (var si = 0; si < n; si++) {
      var s = (_stuSt[row.id] && _stuSt[row.id][si]) || {on: false, vel: 0.75};
      if (!s.on) continue;
      var tick = si * ticksPerStep;
      var vel = Math.round(s.vel * 127);
      events.push([tick,       [0x99, note, vel]]);   // note on  ch10
      events.push([tick + ticksPerStep * 0.9, [0x89, note, 0]]); // note off
    }
  });

  // Sort by tick
  events.sort(function(a, b) { return a[0] - b[0]; });

  // Convert to delta-time bytes
  function varLen(v) {
    v = Math.round(v);
    if (v < 128) return [v];
    var out = [];
    while (v > 0) { out.unshift(v & 0x7F); v >>= 7; }
    for (var i = 0; i < out.length - 1; i++) out[i] |= 0x80;
    return out;
  }

  var trackBytes = [];
  var lastTick = 0;
  events.forEach(function(ev) {
    var delta = ev[0] - lastTick;
    lastTick = ev[0];
    varLen(delta).forEach(function(b) { trackBytes.push(b); });
    ev[1].forEach(function(b) { trackBytes.push(b); });
  });
  // End of track
  trackBytes.push(0x00, 0xFF, 0x2F, 0x00);

  // Build SMF header
  function int32(v) { return [(v>>24)&0xFF,(v>>16)&0xFF,(v>>8)&0xFF,v&0xFF]; }
  function int16(v) { return [(v>>8)&0xFF, v&0xFF]; }

  var header = [
    0x4D,0x54,0x68,0x64, // MThd
    0,0,0,6,              // length=6
    0,0,                  // format 0
    0,1,                  // 1 track
    (ppq>>8)&0xFF, ppq&0xFF // PPQ
  ];

  var trackLen = int32(trackBytes.length);
  var track = [0x4D,0x54,0x72,0x6B].concat(trackLen).concat(trackBytes); // MTrk

  var bytes = new Uint8Array(header.concat(track));
  var blob = new Blob([bytes], {type: 'audio/midi'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'MTS_Percussion_' + _cur.id + '.mid';
  a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

// ─────────────────────────────────────────────
// GRID RENDERING
// ─────────────────────────────────────────────
function _setCV(cell, s, color, hidden) {
  cell.classList.remove('on'); cell.style.background = ''; cell.style.borderColor = '';
  var f = cell.querySelector('.vf');
  if (s.on && !hidden) {
    cell.classList.add('on'); cell.style.borderColor = 'transparent';
    cell.style.background = color + '18';
    f.style.height = (s.vel * 100) + '%'; f.style.background = color + 'cc';
  } else { f.style.height = '0%'; }
}

function _mkSt() {
  var o = {};
  _arows.forEach(function(r) {
    o[r.id] = Array.from({length:64}, function() { return {on:false, vel:0.75}; });
  });
  return o;
}

function _renderShell() {
  _root.innerHTML = "<div class=\"header\">\n    <div class=\"logo\">\n      <div class=\"logo-mark\"><span>MTS</span></div>\n      <span class=\"logo-text\">Percussion Trainer</span>\n    </div>\n    <span class=\"badge-sm\">Cinematic Series</span>\n  </div>\n  <div class=\"curriculum\" id=\"curriculum\"></div>\n  <div class=\"phase-bar\">\n    <div class=\"ps ps-a\" id=\"ph0\"><span class=\"ps-n\">00</span><span class=\"ps-l\">WATCH</span></div>\n    <div class=\"ps\" id=\"ph1\"><span class=\"ps-n\">01</span><span class=\"ps-l\">LISTEN</span></div>\n    <div class=\"ps\" id=\"ph2\"><span class=\"ps-n\">02</span><span class=\"ps-l\">BUILD</span></div>\n    <div class=\"ps\" id=\"ph3\"><span class=\"ps-n\">03</span><span class=\"ps-l\">CHECK</span></div>\n    <div class=\"ps\" id=\"ph4\"><span class=\"ps-n\">04</span><span class=\"ps-l\">REFINE</span></div>\n  </div>\n  <div style=\"margin-bottom:16px;\">\n    <div class=\"sec-label\">\n      <span class=\"sec-t\">Lesson</span>\n      <span class=\"sbadge sb-w\" id=\"lesson-badge\">\u2014</span>\n      <div class=\"sec-line\"></div>\n      <span style=\"font-size:10px;color:var(--txt3);\" id=\"level-badge\"></span>\n    </div>\n    <div class=\"glass\" style=\"padding:16px;\">\n      <div class=\"vid-ph\">\n        <div style=\"font-size:32px;opacity:0.18;color:var(--g);\">\u25b6</div>\n        <div style=\"font-size:12px;color:var(--txt3);letter-spacing:0.1em;\">Spotlightr Video</div>\n        <div style=\"font-size:10px;color:rgba(194,166,103,0.3);font-family:monospace;margin-top:3px;\" id=\"vid-id\">\u2014</div>\n      </div>\n      <div style=\"display:flex;justify-content:space-between;margin-top:9px;align-items:center;\">\n        <span style=\"font-size:10px;color:var(--txt2);font-variant-numeric:tabular-nums;\" id=\"vp-pct\">0% watched</span>\n        <span style=\"font-size:10px;\" id=\"vp-hint\">Watch 80% to continue</span>\n      </div>\n      <div class=\"vp-bar\"><div class=\"vp-fill\" id=\"vp-fill\" style=\"width:0%\"></div></div>\n      <div style=\"margin-top:11px;display:flex;align-items:center;gap:12px;padding-left:16px;\">\n        <button class=\"tbtn primary\" id=\"btn-sim\">\u25b6 Play Video (Demo)</button>\n        <span style=\"font-size:10px;color:var(--txt3);\">Production: real Spotlightr player here</span>\n      </div>\n    </div>\n  </div>\n  <div class=\"glass ctrl-p\" style=\"margin-bottom:16px;\">\n    <div class=\"cg\"><span class=\"cl\">BPM</span>\n      <input type=\"range\" id=\"bpm\" min=\"40\" max=\"200\" value=\"80\" step=\"1\" style=\"width:76px;\">\n      <span class=\"bv\" id=\"bv\">80</span>\n    </div>\n    <div class=\"sep\"></div>\n    <div class=\"cg\"><span class=\"cl\">Subdivision</span><span id=\"sub-d\" style=\"font-size:12px;color:var(--txt);font-weight:500;\">\u2014</span></div>\n    <div class=\"sep\"></div>\n    <div class=\"cg\"><span class=\"cl\">Bars</span><span id=\"bar-d\" style=\"font-size:12px;color:var(--txt);font-weight:500;\">\u2014</span></div>\n    <div class=\"sep\"></div>\n    <div class=\"cg\"><span class=\"cl\">Check Mode</span>\n      <button class=\"co-btn sel\" id=\"co-r\">Rhythm</button>\n      <button class=\"co-btn\" id=\"co-v\">+ Velocity</button>\n    </div>\n    <div style=\"margin-left:auto;display:flex;gap:8px;\">\n      <button class=\"tbtn secondary\" id=\"btn-midi\">\u2193 MIDI</button>\n      <button class=\"tbtn dng\" id=\"btn-reset\">\u21ba Reset</button>\n    </div>\n  </div>\n  <div style=\"margin-bottom:16px;\">\n    <div style=\"display:flex;align-items:center;gap:10px;margin-bottom:9px;padding-left:16px;flex-wrap:wrap;\">\n      <button class=\"tbtn primary\" id=\"btn-listen\">\u25b6 Listen</button>\n      <span class=\"sbadge sb-l\" id=\"ref-badge\">Hidden</span>\n      <span style=\"font-size:10px;color:var(--txt3);\" id=\"play-ct\"></span>\n    </div>\n    <div class=\"glass\" style=\"position:relative;\">\n      <div class=\"grid-s\"><div class=\"snums\" id=\"ref-nums\"></div><div id=\"ref-rows\"></div></div>\n      <div class=\"rmask\" id=\"rmask\">\n        <div class=\"rmask-icon\">\u25c9</div>\n        <div class=\"rmask-txt\">Pattern hidden<br><span style=\"font-size:11px;color:rgba(255,255,255,0.28);\">Watch the lesson \u2014 then listen</span></div>\n      </div>\n    </div>\n  </div>\n  <div style=\"display:flex;align-items:center;gap:14px;margin:20px 0 18px;\">\n    <div class=\"gold-divider\" style=\"flex:1;height:1px;\"></div>\n    <span style=\"font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(194,166,103,0.35);padding:0 4px;\">Exercise</span>\n    <div class=\"gold-divider\" style=\"flex:1;height:1px;\"></div>\n  </div>\n  <div style=\"margin-bottom:16px;\">\n    <div style=\"display:flex;align-items:center;gap:10px;margin-bottom:9px;padding-left:16px;flex-wrap:wrap;\">\n      <button class=\"tbtn primary\" id=\"btn-build\" disabled style=\"opacity:0.35;cursor:not-allowed;\">\u2192 Start Building</button>\n      <span class=\"sbadge sb-b\" id=\"build-badge\">Waiting...</span>\n      <div id=\"stu-strip\" style=\"display:none;gap:8px;align-items:center;display:none;\">\n        <span style=\"width:1px;height:18px;background:var(--bdr);display:inline-block;\"></span>\n        <button class=\"tbtn secondary\" id=\"btn-sp\">\u25b6 Play</button>\n        <button class=\"tbtn act-s\" id=\"btn-ss\" style=\"display:none;\">\u25a0 Stop</button>\n        <button class=\"tbtn dng\" id=\"btn-clear-stu\">\u2715 Clear</button>\n        <button class=\"tbtn primary\" id=\"btn-check\">\u2713 Check</button>\n      </div>\n    </div>\n    <div class=\"glass glass-gold\" id=\"stu-sec\" style=\"opacity:0.32;pointer-events:none;\">\n      <div class=\"grid-s\"><div class=\"snums\" id=\"stu-nums\"></div><div id=\"stu-rows\"></div></div>\n    </div>\n  </div>\n  <div class=\"glass glass-green score-p\" id=\"score-p\">\n    <div><div class=\"sc-big\" id=\"sc-tot\">\u2014</div><div class=\"sc-lbl\">Score</div></div>\n    <div id=\"sc-bd\" style=\"display:flex;gap:18px;flex-wrap:wrap;align-items:center;\"></div>\n    <div style=\"margin-left:auto;display:flex;flex-direction:column;gap:7px;align-items:flex-end;\">\n      <button class=\"tbtn primary\" id=\"btn-reveal\">\u25c9 Reveal &amp; Refine</button>\n      <div class=\"unlock-b\" id=\"unlock-b\">\ud83c\udfaf Next lesson unlocked!</div>\n    </div>\n  </div>";
}

function _buildNums(id) {
  var el = _root.querySelector('#' + id); el.innerHTML = '';
  var n = _cur.subdiv * _cur.bars, sd = _cur.subdiv;
  for (var i = 0; i < n; i++) {
    var d = document.createElement('div');
    d.className = 'sn' + (i % sd === 0 ? ' b' : '');
    d.textContent = i % sd === 0 ? (Math.floor(i/sd)+1) : '';
    el.appendChild(d);
  }
}

function _buildGrid(cid, st, ed, hidden) {
  var el = _root.querySelector('#' + cid); el.innerHTML = '';
  var n = _cur.subdiv * _cur.bars, sd = _cur.subdiv;
  _arows.forEach(function(row, ri) {
    if (ri > 0) { var dv = document.createElement('div'); dv.className = 'rdiv'; el.appendChild(dv); }
    var rw = document.createElement('div'); rw.className = 'grow';
    var lb = document.createElement('div'); lb.className = 'rl';
    lb.innerHTML = '<div class="rn" style="color:'+row.color+'">'+row.name+'</div><div class="rs">'+row.sub+'</div>';
    rw.appendChild(lb);
    var cs = document.createElement('div'); cs.className = 'cells';
    for (var si = 0; si < n; si++) {
      (function(si) {
        var s = (st[row.id] && st[row.id][si]) || {on:false, vel:0.75};
        var cell = document.createElement('div');
        cell.className = 'cell' + (si%sd===0?' bs':'') + (hidden?' hr':'') + (ed?'':' locked');
        cell.id = cid + '-c-' + row.id + '-' + si;
        var vf = document.createElement('div'); vf.className = 'vf'; cell.appendChild(vf);
        _setCV(cell, s, row.color, hidden);
        if (ed) {
          var da=false, dy0=0, dv0=0, dragged=false;
          cell.addEventListener('mousedown', function(e) {
            if (e.button!==0) return; e.preventDefault();
            da=true; dragged=false; dy0=e.clientY; dv0=s.vel;
          });
          document.addEventListener('mousemove', function(e) {
            if (!da) return; var dy=dy0-e.clientY;
            if (Math.abs(dy)>3) dragged=true;
            if (dragged && s.on) { s.vel=Math.max(.05,Math.min(1,dv0+dy/50)); _setCV(cell,s,row.color,false); }
          });
          document.addEventListener('mouseup', function() {
            if (!da) return; da=false;
            if (!dragged) {
              _iAudio(); s.on=!s.on;
              if (s.on) { s.vel=dv0||.75; _drum(row.id,s.vel); }
              cell.classList.remove('ok','wo','wm');
              _setCV(cell,s,row.color,false);
            }
          });
        }
        cs.appendChild(cell);
      })(si);
    }
    rw.appendChild(cs); el.appendChild(rw);
  });
}

// ─────────────────────────────────────────────
// CURRICULUM UI
// ─────────────────────────────────────────────
function _buildCurUI() {
  var el = _root.querySelector('#curriculum'); if (!el) return;
  el.innerHTML = '';
  _CUR.forEach(function(l, i) {
    var p = _getProg(l.id), ok = _unlocked(i);
    var c = document.createElement('div');
    c.className = 'lchip' + (_cur&&_cur.id===l.id?' lc-act':'') + (p.done?' lc-done':'') + (ok?'':' lc-lck');
    c.innerHTML = '<span class="lc-n">L'+l.level+'.'+(i%3+1)+'</span>'
                + '<span class="lc-t">'+l.title+'</span>'
                + (p.done ? '<span class="lc-s">✓ '+p.score+'%</span>' : p.score>0 ? '<span class="lc-s">'+p.score+'%</span>' : '');
    if (ok) c.onclick = (function(idx) { return function() { _loadLesson(idx); }; })(i);
    el.appendChild(c);
  });
}

// ─────────────────────────────────────────────
// LOAD LESSON
// ─────────────────────────────────────────────
function _loadLesson(idx) {
  _stopPb(); _clearSim();
  _cur = _CUR[idx];
  _arows = ROWS.filter(function(r) { return _cur.rows.indexOf(r.id) >= 0; });
  _bpmV = _cur.bpm;
  var bpmEl = _root.querySelector('#bpm'); if (bpmEl) bpmEl.value = _bpmV;
  var bvEl  = _root.querySelector('#bv');  if (bvEl)  bvEl.textContent = _bpmV;
  var sdEl  = _root.querySelector('#sub-d'); if (sdEl) sdEl.textContent = SDLBL[_cur.subdiv] || _cur.subdiv;
  var barEl = _root.querySelector('#bar-d'); if (barEl) barEl.textContent = _cur.bars;
  var lbEl  = _root.querySelector('#lesson-badge'); if (lbEl) lbEl.textContent = _cur.title;
  var lvEl  = _root.querySelector('#level-badge');  if (lvEl) lvEl.textContent = 'Level '+_cur.level+'  ·  Pass: '+_cur.pass+'%';
  var vidEl = _root.querySelector('#vid-id');       if (vidEl) vidEl.textContent = 'Video ID: ' + _cur.vid;

  _refSt = {};
  _arows.forEach(function(r) {
    var pat = _cur.pat[r.id] || [], vel = _cur.vel[r.id] || [];
    _refSt[r.id] = Array.from({length:64}, function(_,i) {
      return i < pat.length ? {on:!!pat[i], vel:vel[i]||.75} : {on:false, vel:.75};
    });
  });
  _stuSt = _mkSt();
  _vidPct = 0; _playCt = 0; _phase = 'watch';
  _updVid(0); _setPhase('watch');

  // Reset UI elements
  var rmask   = _root.querySelector('#rmask');       if (rmask)   rmask.classList.remove('gone');
  var refBadge= _root.querySelector('#ref-badge');   if (refBadge){ refBadge.textContent='Hidden'; refBadge.className='sbadge sb-l'; }
  var bl      = _root.querySelector('#btn-listen');
  if (bl) { bl.disabled=false; bl.textContent='▶ Listen'; bl.className='tbtn primary'; }
  var bb      = _root.querySelector('#btn-build');
  if (bb) { bb.disabled=true; bb.style.opacity='0.35'; bb.style.cursor='not-allowed'; }
  var pct     = _root.querySelector('#play-ct');     if (pct) pct.textContent = '';
  var stuSec  = _root.querySelector('#stu-sec');     if (stuSec) { stuSec.style.opacity='0.32'; stuSec.style.pointerEvents='none'; }
  var strip   = _root.querySelector('#stu-strip');   if (strip) strip.style.display='none';
  var bBadge  = _root.querySelector('#build-badge'); if (bBadge) { bBadge.textContent='Waiting...'; bBadge.className='sbadge sb-b'; }
  var scoreP  = _root.querySelector('#score-p');     if (scoreP) scoreP.classList.remove('vis');
  var unlockB = _root.querySelector('#unlock-b');    if (unlockB) unlockB.classList.remove('vis');
  var btnChk  = _root.querySelector('#btn-check');   if (btnChk) btnChk.textContent='✓ Check';
  var btnSim  = _root.querySelector('#btn-sim');     if (btnSim) btnSim.textContent='▶ Play Video (Demo)';
  var vph     = _root.querySelector('#vp-hint');     if (vph) { vph.textContent='Watch '+_cur.unlock+'% to continue'; vph.style.color='rgba(194,166,103,0.5)'; }
  _showSP(false);

  _buildNums('ref-nums'); _buildNums('stu-nums');
  _buildGrid('ref-rows', _refSt, false, true);
  _buildGrid('stu-rows', _stuSt, false, false);
  _buildCurUI();
}

// ─────────────────────────────────────────────
// VIDEO PROGRESS
// ─────────────────────────────────────────────
function _updVid(p) {
  _vidPct = p;
  var pctEl = _root.querySelector('#vp-pct'); if (pctEl) pctEl.textContent = Math.round(p*100) + '% watched';
  var fillEl= _root.querySelector('#vp-fill'); if (fillEl) fillEl.style.width = (p*100) + '%';
  var hint  = _root.querySelector('#vp-hint');
  if (p >= _cur.unlock/100) {
    if (hint) { hint.textContent='✓ ' + Math.round(p*100) + '% watched'; hint.style.color='rgba(100,220,120,0.75)'; }
    var bl = _root.querySelector('#btn-listen'); if (bl) bl.disabled = false;
  }
}

// Spotlightr integration:
// document.addEventListener('vooPlayerReady', function() {
//   setInterval(function() {
//     spotlightrAPI(_cur.vid, 'getCurrentTime', null, function(t) {
//       spotlightrAPI(_cur.vid, 'getDuration', null, function(d) { _updVid(t/d); });
//     });
//   }, 2000);
// });

// ─────────────────────────────────────────────
// PHASE MANAGEMENT
// ─────────────────────────────────────────────
function _setPhase(p) {
  _phase = p;
  var ord = ['watch','listen','build','check','refine'], idx = ord.indexOf(p);
  ['ph0','ph1','ph2','ph3','ph4'].forEach(function(id, i) {
    var el = _root.querySelector('#' + id); if (!el) return;
    el.classList.remove('ps-a','ps-d');
    if (i < idx) el.classList.add('ps-d'); else if (i === idx) el.classList.add('ps-a');
  });
}

function _jumpToPhase(t) {
  if (t === _phase) return;
  _stopPb(); _showSP(false);
  if (t === 'watch') { _loadLesson(_CUR.findIndex(function(l){return l.id===_cur.id;})); return; }
  if (t === 'listen') {
    var bl = _root.querySelector('#btn-listen'); if (bl) bl.disabled = false;
    var rmask = _root.querySelector('#rmask'); if (rmask) rmask.classList.remove('gone');
    var rb = _root.querySelector('#ref-badge'); if (rb) { rb.textContent='Hidden'; rb.className='sbadge sb-l'; }
    _setPhase('listen'); return;
  }
  if (t === 'build' || t === 'check') {
    var bl2 = _root.querySelector('#btn-listen'); if (bl2) bl2.disabled = false;
    var bb = _root.querySelector('#btn-build');
    if (bb) { bb.disabled=false; bb.style.opacity='1'; bb.style.cursor='pointer'; }
    _stuSt = _mkSt(); _buildGrid('stu-rows', _stuSt, true, false);
    var ss = _root.querySelector('#stu-sec'); if (ss) { ss.style.opacity='1'; ss.style.pointerEvents='auto'; }
    var strip = _root.querySelector('#stu-strip'); if (strip) strip.style.display='flex';
    var bBadge = _root.querySelector('#build-badge'); if (bBadge) { bBadge.textContent='Building...'; bBadge.className='sbadge sb-b'; }
    _setPhase('build'); return;
  }
  if (t === 'refine') { _jumpToPhase('build'); setTimeout(_doReveal, 50); }
}

// ─────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────
function _showSP(p) {
  var sp = _root.querySelector('#btn-sp'); if (sp) sp.style.display = p ? 'none' : '';
  var ss = _root.querySelector('#btn-ss'); if (ss) ss.style.display = p ? '' : 'none';
}

function _doCheck() {
  _stopPb(); _showSP(false); _setPhase('check');
  var n = _cur.subdiv * _cur.bars, ok=0, tot=0, vs=0, vt=0, bd=[];
  _arows.forEach(function(row) {
    var rc = 0;
    for (var si = 0; si < n; si++) {
      var r = (_refSt[row.id] && _refSt[row.id][si]) || {on:false,vel:.75};
      var s = (_stuSt[row.id] && _stuSt[row.id][si]) || {on:false,vel:.75};
      var cell = _root.querySelector('#stu-rows-c-'+row.id+'-'+si);
      if (!cell) continue; tot++;
      cell.classList.remove('ok','wo','wm');
      if (r.on===s.on) {
        ok++; rc++; cell.classList.add('ok');
        if (_checkM==='velocity'&&r.on){vt++;vs+=(1-Math.abs(r.vel-s.vel));}
      } else if (s.on&&!r.on) { cell.classList.add('wo'); } else { cell.classList.add('wm'); }
    }
    bd.push({name:row.name, color:row.color, sc:Math.round(rc/n*100)});
  });
  var rp = Math.round(ok/tot*100), fin=rp;
  if (_checkM==='velocity'&&vt>0) fin = Math.round(rp*.6+(vs/vt*100)*.4);
  var scEl = _root.querySelector('#sc-tot'); if (scEl) scEl.textContent = fin + '%';
  var bdEl = _root.querySelector('#sc-bd'); if (bdEl) {
    bdEl.innerHTML = '';
    bd.forEach(function(b) {
      var d=document.createElement('div'); d.className='sc-item';
      d.innerHTML='<div class="sc-val" style="color:'+b.color+'">'+b.sc+'%</div><div class="sc-sub">'+b.name+'</div>';
      bdEl.appendChild(d);
    });
  }
  var sp = _root.querySelector('#score-p'); if (sp) sp.classList.add('vis');
  var bb2 = _root.querySelector('#build-badge'); if (bb2) { bb2.textContent='Checked'; bb2.className='sbadge sb-c'; }
  var bc = _root.querySelector('#btn-check'); if (bc) bc.textContent='↺ Check Again';
  var passed = fin >= _cur.pass;
  _saveProg(_cur.id, fin, passed);
  if (passed) { var ub = _root.querySelector('#unlock-b'); if (ub) ub.classList.add('vis'); }
  _buildCurUI();
}

function _doReveal() {
  _setPhase('refine');
  var rmask = _root.querySelector('#rmask'); if (rmask) rmask.classList.add('gone');
  var rb = _root.querySelector('#ref-badge'); if (rb) { rb.textContent='Revealed'; rb.className='sbadge sb-c'; }
  _buildGrid('ref-rows', _refSt, false, false);
  _buildGrid('stu-rows', _stuSt, true, false);
  var ss = _root.querySelector('#stu-sec'); if (ss) { ss.style.opacity='1'; ss.style.pointerEvents='auto'; }
  var strip = _root.querySelector('#stu-strip'); if (strip) strip.style.display='flex';
  var bb = _root.querySelector('#build-badge'); if (bb) { bb.textContent='Refining...'; bb.className='sbadge sb-b'; }
}

function _clearStu() {
  _stuSt = _mkSt(); _buildGrid('stu-rows', _stuSt, true, false);
}

function _clearSim() {
  if (_simIv) { clearInterval(_simIv); _simIv = null; }
}

function _simVideo() {
  _clearSim(); _simP = _vidPct;
  var btn = _root.querySelector('#btn-sim'); if (btn) btn.textContent = '⏸ Playing...';
  _simIv = setInterval(function() {
    _simP = Math.min(1, _simP + 0.018); _updVid(_simP);
    if (_simP >= 1) { _clearSim(); var b=_root.querySelector('#btn-sim'); if(b)b.textContent='✓ Watched'; }
  }, 180);
}

// ─────────────────────────────────────────────
// EVENT BINDING
// ─────────────────────────────────────────────
function _bindEvents() {
  function on(sel, ev, fn) {
    var el = _root.querySelector(sel); if (el) el.addEventListener(ev, fn);
  }

  on('#btn-listen', 'click', function() {
    if (_pbCtx && _pbCtx.tgt === 'ref-rows') {
      _stopPb();
      var bl = _root.querySelector('#btn-listen');
      if (bl) { bl.textContent=_playCt===0?'▶ Listen':'▶ Listen Again'; bl.className='tbtn primary'; }
      return;
    }
    var bl = _root.querySelector('#btn-listen');
    if (bl) { bl.textContent='■ Stop'; bl.className='tbtn act-s'; }
    _startPb('ref-rows', _refSt, false, function() {
      _playCt++;
      var pc = _root.querySelector('#play-ct'); if (pc) pc.textContent = _playCt + '× heard';
      var bb = _root.querySelector('#btn-build');
      if (bb) { bb.disabled=false; bb.style.opacity='1'; bb.style.cursor='pointer'; }
      var bl2 = _root.querySelector('#btn-listen');
      if (bl2) { bl2.textContent='▶ Listen Again'; bl2.className='tbtn secondary'; }
    });
  });

  on('#btn-build', 'click', function() {
    _stopPb();
    var bl = _root.querySelector('#btn-listen'); if (bl) { bl.textContent='▶ Listen Again'; bl.className='tbtn secondary'; }
    _setPhase('build'); _stuSt = _mkSt(); _buildGrid('stu-rows', _stuSt, true, false);
    var ss = _root.querySelector('#stu-sec'); if (ss) { ss.style.opacity='1'; ss.style.pointerEvents='auto'; }
    var strip = _root.querySelector('#stu-strip'); if (strip) strip.style.display='flex';
    var bb = _root.querySelector('#build-badge'); if (bb) { bb.textContent='Building...'; bb.className='sbadge sb-b'; }
  });

  on('#btn-sp', 'click', function() {
    if (_pbCtx && _pbCtx.tgt==='stu-rows') { _stopPb(); _showSP(false); return; }
    _stopPb(); _showSP(true); _startPb('stu-rows', _stuSt, true, null);
  });

  on('#btn-ss', 'click', function() { _stopPb(); _showSP(false); });
  on('#btn-check', 'click', _doCheck);
  on('#btn-reveal', 'click', _doReveal);
  on('#btn-clear-stu', 'click', _clearStu);
  on('#btn-sim', 'click', _simVideo);
  on('#btn-midi', 'click', _exportMIDI);

  on('#btn-reset', 'click', function() {
    _loadLesson(_CUR.findIndex(function(l) { return l.id === _cur.id; }));
  });

  on('#bpm', 'input', function(e) {
    _bpmV = parseInt(e.target.value);
    var bv = _root.querySelector('#bv'); if (bv) bv.textContent = _bpmV;
  });

  on('#co-r', 'click', function() {
    _checkM = 'rhythm';
    var cr=_root.querySelector('#co-r'), cv=_root.querySelector('#co-v');
    if(cr) cr.classList.add('sel'); if(cv) cv.classList.remove('sel');
  });
  on('#co-v', 'click', function() {
    _checkM = 'velocity';
    var cr=_root.querySelector('#co-r'), cv=_root.querySelector('#co-v');
    if(cr) cr.classList.remove('sel'); if(cv) cv.classList.add('sel');
  });

  // Phase bar navigation
  var phOrd = ['watch','listen','build','check','refine'];
  ['ph0','ph1','ph2','ph3','ph4'].forEach(function(id, i) {
    var el = _root.querySelector('#' + id);
    if (el) el.addEventListener('click', function() { _jumpToPhase(phOrd[i]); });
  });
}

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────
var MTSPercussion = {

  init: function(config) {
    _config = config || {};
    _CUR    = _config.curriculum || DEFAULT_CURRICULUM;

    // Resolve container
    if (typeof _config.container === 'string') {
      _root = document.querySelector(_config.container);
    } else if (_config.container instanceof Element) {
      _root = _config.container;
    } else {
      console.error('MTSPercussion: container not found');
      return;
    }

    // Self-render the UI shell if the container is empty (e.g. a bare
    // <div id="mts-trainer"></div> embed). If a full shell was pasted
    // manually, leave it untouched (backwards compatible).
    if (!_root.querySelector('#curriculum')) {
      _renderShell();
    }

    // Load samples async (non-blocking)
    _loadSamples();

    // Load initial lesson
    var startIdx = 0;
    if (_config.lessonId) {
      var idx = _CUR.findIndex(function(l) { return l.id === _config.lessonId; });
      if (idx >= 0) startIdx = idx;
    }
    _loadLesson(startIdx);
    _bindEvents();
  },

  // Load a specific lesson by ID
  loadLesson: function(lessonId) {
    var idx = _CUR.findIndex(function(l) { return l.id === lessonId; });
    if (idx >= 0) _loadLesson(idx);
  },

  // Manually update video progress (0.0–1.0) — call from Spotlightr callback
  setVideoProgress: function(pct) { _updVid(pct); },

  // Export student pattern as MIDI
  exportMIDI: _exportMIDI,

  // Get current state (for custom save logic)
  getState: function() {
    return {
      lessonId: _cur ? _cur.id : null,
      phase:    _phase,
      stuSt:    _stuSt,
      bpm:      _bpmV
    };
  }
};

global.MTSPercussion = MTSPercussion;

})(window);
