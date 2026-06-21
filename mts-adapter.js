/**
 * mts-adapter.js — MTS Universal Tool Adapter
 * ════════════════════════════════════════════════════════════════════
 * The ONE bridge between the Webflow lesson page and any MTS tool.
 * This is the only file that knows about Webflow / Outseta.
 * Each tool (mts-percussion.js, mts-satb.js, ...) knows nothing about
 * the platform — it only exposes an init() and fires callbacks.
 *
 * HOW IT WORKS (one Lessons template page serves ALL tools):
 *   The lesson page sets two globals from its CMS fields, BEFORE this
 *   adapter runs:
 *
 *     window.MTS_LESSON = {
 *       tool:   'percussion',                 // from CMS "tool" field
 *       lesson: 'p-1-1',                      // from CMS "tool-lesson-id"
 *       video:  '<spotlightr id or iframe>'   // from CMS "spotlightr-video"
 *     };
 *     window.MTS_TOOL = {
 *       sampleBase: 'https://bucket/.../'     // from CMS "sample-base"
 *     };
 *
 *   Then this adapter looks at MTS_LESSON.tool, finds the matching
 *   container on the page, and mounts the right tool into it.
 *   New lesson  =  fill CMS fields. No code. No new embed.
 *
 * LOAD ORDER (Lessons template footer — handled by the loader script):
 *   1. tool CSS + JS for whatever tools the site uses
 *   2. mts-adapter.js   (this file — last)
 * ════════════════════════════════════════════════════════════════════
 */

(function (global) {
'use strict';

// ── TOOL REGISTRY ────────────────────────────────────────────────────
// Maps the CMS "tool" value → how to mount that tool.
// To add a new tool later: add one entry here. Nothing else changes.
//
//   key        = the lowercased CMS tool name (spaces → hyphens)
//   global     = the window global the tool exposes
//   container  = the element id the tool mounts into (must exist on page)
//   mount(api, L, T) = how to start it, given the tool global + lesson + tool config
var TOOLS = {
  'percussion': {
    global:    'MTSPercussion',
    container: 'mts-trainer',
    mount: function (api, L, T) {
      api.init({
        container: '#mts-trainer',
        lessonId:  L.lesson,
        audioBase: (T && T.sampleBase) || '',
        onSave:    MTSAdapter._onSave
      });
      if (L.video && typeof api.setVideo === 'function') api.setVideo(L.video);
    }
  },
  'set-theory': {
    global:    'MTSSetTheory',
    container: 'mts-tool-container',
    mount: function (api, L, T) {
      api.init({ container: '#mts-tool-container', lessonId: L.lesson, onSave: MTSAdapter._onSave });
    }
  },
  'satb-voice-leading': {
    global:    'MTSSATB',
    container: 'mts-tool-container',
    mount: function (api, L, T) {
      api.init({ container: '#mts-tool-container', lessonId: L.lesson, onSave: MTSAdapter._onSave });
    }
  }
  // add future tools here ↑  (counterpoint, ear-trainer, motif, ...)
};

var MTSAdapter = {

  // ⚙️ SET THIS to your Outseta subdomain (e.g. 'masterthescore')
  OUTSETA_SUBDOMAIN: 'YOUR_SUBDOMAIN',

  /**
   * Normalise a CMS tool label to a registry key.
   * "Percussion Trainer" → "percussion"
   * "SATB Voice Leading" → "satb-voice-leading"
   * "Set Theory"         → "set-theory"
   */
  _key: function (raw) {
    if (!raw) return '';
    var k = String(raw).toLowerCase().trim()
      .replace(/\s+trainer$/, '')   // drop a trailing "trainer"
      .replace(/\s+/g, '-');
    // friendly aliases
    if (k === 'percussion') return 'percussion';
    return k;
  },

  /** Auto-run on load: read globals, mount the right tool. */
  boot: function () {
    var L = global.MTS_LESSON || {};
    var T = global.MTS_TOOL   || {};
    var key = MTSAdapter._key(L.tool);

    if (!key || key === 'none') return;          // lesson has no tool — fine
    var def = TOOLS[key];
    if (!def) { console.warn('[MTSAdapter] unknown tool:', L.tool); return; }

    var api = global[def.global];
    if (!api || typeof api.init !== 'function') {
      console.warn('[MTSAdapter] tool script not loaded for:', key, '(expected window.' + def.global + ')');
      return;
    }
    if (!document.getElementById(def.container)) {
      console.warn('[MTSAdapter] container #' + def.container + ' not found on page for tool:', key);
      return;
    }
    try { def.mount(api, L, T); }
    catch (e) { console.error('[MTSAdapter] mount failed for', key, e); }
  },

  /** Progress callback shared by all tools → Outseta. */
  _onSave: function (id, score, done) {
    if (typeof global.Outseta === 'undefined') return;   // localStorage fallback handled in-tool
    try {
      var token = global.Outseta.getAccessToken && global.Outseta.getAccessToken();
      if (!token) return;
      var body = {};
      body['tool_' + id + '_score'] = score;
      body['tool_' + id + '_done']  = done;
      fetch('https://' + MTSAdapter.OUTSETA_SUBDOMAIN + '.outseta.com/api/v1/crm/people/me', {
        method:  'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
      }).then(function (r) { if (!r.ok) console.warn('[MTSAdapter] Outseta save', r.status); })
        .catch(function (e) { console.warn('[MTSAdapter] Outseta save failed', e); });
    } catch (e) { console.warn('[MTSAdapter] save error', e); }
  },

  /** Manual mount escape hatch (rarely needed). */
  mountLesson: function (LESSON) {
    if (LESSON) global.MTS_LESSON = LESSON;
    MTSAdapter.boot();
  }
};

global.MTSAdapter = MTSAdapter;

// Auto-boot once the DOM is ready.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', MTSAdapter.boot);
} else {
  MTSAdapter.boot();
}

})(window);
