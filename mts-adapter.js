/**
 * mts-adapter.js — MTS Percussion Trainer ↔ Webflow/Outseta bridge
 *
 * This is the ONLY file that knows about Outseta and Webflow.
 * The tool (mts-percussion.js) knows nothing about the platform —
 * it only fires callbacks. Swap platforms later? Rewrite only this file.
 *
 * Load order on the Webflow page (site-wide footer code):
 *   1. mts-percussion.css   (in <head> or footer)
 *   2. mts-percussion.js
 *   3. mts-adapter.js
 *
 * Then each lesson page calls:  MTSAdapter.mountLesson(LESSON)
 */

(function(global) {
'use strict';

var MTSAdapter = {

  /**
   * Mount the percussion trainer for one lesson.
   * @param {Object} LESSON - config bound from Webflow CMS fields:
   *   {
   *     container: '#mts-trainer',   // selector of the embed div
   *     lessonId:  '1-1',            // unique lesson id (CMS slug or field)
   *     audioBase: 'https://...',    // sample bucket URL (CORS enabled)
   *     curriculum: [...]            // optional — single-lesson or full array
   *   }
   */
  mountLesson: function(LESSON) {
    if (!global.MTSPercussion) {
      console.error('[MTSAdapter] mts-percussion.js not loaded');
      return;
    }

    MTSPercussion.init({
      container:  LESSON.container || '#mts-trainer',
      lessonId:   LESSON.lessonId,
      audioBase:  LESSON.audioBase || '',
      curriculum: LESSON.curriculum,   // undefined = use tool's DEFAULT_CURRICULUM

      // ── PROGRESS CALLBACK ──────────────────────────────
      // Fires after every Check. Writes to Outseta custom fields.
      onSave: function(id, score, done) {
        MTSAdapter._saveToOutseta(id, score, done);
      }
    });
  },

  /**
   * Write progress to the Outseta Person record.
   * Custom fields needed in Outseta (per lesson):
   *   perc_{id}_score  — Number
   *   perc_{id}_done   — Checkbox/Boolean
   */
  _saveToOutseta: function(id, score, done) {
    // Guard: only run if Outseta is present and a user is logged in
    if (typeof global.Outseta === 'undefined') {
      console.log('[MTSAdapter] Outseta not present — progress kept in localStorage only');
      return;
    }

    try {
      var token = global.Outseta.getAccessToken && global.Outseta.getAccessToken();
      if (!token) { return; }

      var body = {};
      body['perc_' + id + '_score'] = score;
      body['perc_' + id + '_done']  = done;

      fetch('https://' + MTSAdapter.OUTSETA_SUBDOMAIN + '.outseta.com/api/v1/crm/people/me', {
        method:  'PUT',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify(body)
      })
      .then(function(r) {
        if (!r.ok) console.warn('[MTSAdapter] Outseta save returned', r.status);
      })
      .catch(function(e) {
        console.warn('[MTSAdapter] Outseta save failed', e);
      });
    } catch (e) {
      console.warn('[MTSAdapter] save error', e);
    }
  },

  // ⚙️ SET THIS to your Outseta subdomain (e.g. 'masterthescore')
  OUTSETA_SUBDOMAIN: 'YOUR_SUBDOMAIN'
};

global.MTSAdapter = MTSAdapter;

})(window);
