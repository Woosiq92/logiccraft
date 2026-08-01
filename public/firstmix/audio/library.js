/* 내 음악 보관함 — IndexedDB.
 *
 * localStorage 를 쓰면 안 된다. 음원은 수 MB 라 한 곡만 넣어도 한도를 넘고,
 * 넘는 순간 save() 가 통째로 실패해서 다른 저장값까지 같이 날아간다.
 *
 * 저장하는 것: 원본 파일(Blob) + 분석 결과(BPM·첫박).
 * 디코드된 AudioBuffer 는 저장하지 않는다 — 훨씬 크고, 다시 만들면 되니까.
 */
(function (global) {
  'use strict';

  var DB = 'firstmix', STORE = 'tracks', MIXES = 'mixes', VERSION = 2;
  var dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        // v2 에서 녹음한 세트가 들어왔다. 이미 곡을 넣어 둔 사람도 그대로 열려야 한다.
        if (!db.objectStoreNames.contains(MIXES)) db.createObjectStore(MIXES, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbp;
  }

  function tx(mode, fn, storeName) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var name = storeName || STORE;
        var t = db.transaction(name, mode);
        var store = t.objectStore(name);
        var out = fn(store);
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  var Library = {
    /* 목록 (Blob 은 빼고 — 목록 그리는 데 수 MB 를 들고 올 이유가 없다) */
    list: function () {
      return tx('readonly', function (s) { return s.getAll(); }).then(function (rows) {
        return (rows || [])
          .map(function (r) {
            return { id: r.id, name: r.name, bpm: r.bpm, beatOffset: r.beatOffset,
                     size: r.size, addedAt: r.addedAt, confidence: r.confidence, user: true,
                     color: '#94a3b8' };
          })
          .sort(function (a, b) { return b.addedAt - a.addedAt; });
      });
    },

    get: function (id) {
      return tx('readonly', function (s) { return s.get(id); });
    },

    put: function (rec) {
      return tx('readwrite', function (s) { s.put(rec); return rec; });
    },

    remove: function (id) {
      return tx('readwrite', function (s) { s.delete(id); });
    },

    /* 파일 하나를 받아 디코드·분석해서 보관한다. */
    add: function (file, ctx, onStage) {
      var id = 'u' + Date.now() + '-' + Math.round(Math.random() * 1e6);
      var name = String(file.name || global.FirstMix.tr('내 음악', 'My music')).replace(/\.[^.]+$/, '');
      onStage && onStage('decode');
      return file.arrayBuffer()
        .then(function (ab) { return ctx.decodeAudioData(ab.slice(0)); })
        .then(function (buffer) {
          onStage && onStage('analyze');
          var a = global.FirstMix.analyzeBpm(buffer) || { bpm: 120, offset: 0, confidence: 0 };
          var rec = {
            id: id, name: name, blob: file, size: file.size,
            bpm: a.bpm, beatOffset: a.offset, confidence: a.confidence,
            addedAt: Date.now()
          };
          onStage && onStage('save');
          return Library.put(rec).then(function () {
            return {
              meta: { id: id, name: name, bpm: a.bpm, beatOffset: a.offset, size: file.size,
                      addedAt: rec.addedAt, confidence: a.confidence, user: true, color: '#94a3b8' },
              buffer: buffer
            };
          });
        });
    },

    /* ── 녹음한 세트 ──────────────────────────────────
     * 곡과 같은 데이터베이스, 다른 창고. 마스터에서 받은 blob 을 그대로 둔다. */
    addMix: function (blob, seconds, mime) {
      var meta = {
        id: 'm' + Date.now().toString(36),
        at: Date.now(),
        seconds: seconds,
        size: blob.size,
        mime: mime || blob.type || 'audio/webm'
      };
      var rec = {};
      for (var k in meta) rec[k] = meta[k];
      rec.blob = blob;
      return tx('readwrite', function (st) { st.put(rec); }, MIXES).then(function () { return meta; });
    },
    listMixes: function () {
      return tx('readonly', function (st) { return st.getAll(); }, MIXES).then(function (rows) {
        return (rows || [])
          .map(function (r) { return { id: r.id, at: r.at, seconds: r.seconds, size: r.size, mime: r.mime }; })
          .sort(function (a, b) { return b.at - a.at; });
      });
    },
    getMix: function (id) {
      return tx('readonly', function (st) { return st.get(id); }, MIXES);
    },
    removeMix: function (id) {
      return tx('readwrite', function (st) { st.delete(id); }, MIXES);
    },

    /* 보관된 곡을 AudioBuffer 로 되살린다. */
    decode: function (id, ctx) {
      return Library.get(id).then(function (rec) {
        if (!rec) throw new Error('not in library: ' + id);
        return rec.blob.arrayBuffer().then(function (ab) { return ctx.decodeAudioData(ab.slice(0)); });
      });
    }
  };

  global.FirstMix = global.FirstMix || {};
  global.FirstMix.Library = Library;
})(typeof window !== 'undefined' ? window : this);
