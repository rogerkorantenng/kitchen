// Devvit postMessage RPC layer — copied from Trapline with minor naming updates
// server → webview wraps as { type: 'devvit-message', data: { message: <inner> } }

const _pendingRpc = new Map(); // reqId → { responseType, resolve, reject, timer }
let _rpcSeq = 0;

window.addEventListener('message', (ev) => {
  let msg = ev.data;
  // Unwrap Devvit envelope
  if (msg && msg.type === 'devvit-message' && msg.data && msg.data.message) {
    msg = msg.data.message;
  }
  if (!msg || !msg.type) return;

  const data = msg.data ?? {};

  // Resolve by echoed reqId first, then oldest pending matching response type
  let matchId = null;
  if (data.__reqId != null && _pendingRpc.has(data.__reqId)) {
    matchId = data.__reqId;
  } else {
    for (const [id, p] of _pendingRpc) {
      if (p.responseType === msg.type) { matchId = id; break; }
    }
  }
  if (matchId != null) {
    const pending = _pendingRpc.get(matchId);
    _pendingRpc.delete(matchId);
    clearTimeout(pending.timer);
    pending.resolve(data);
  }

  // Non-RPC push messages fire as CustomEvents for listeners
  window.dispatchEvent(new CustomEvent('devvit:' + msg.type, { detail: data }));
});

function rpc(type, payload, responseType) {
  return new Promise((resolve, reject) => {
    const reqId = ++_rpcSeq;
    const timer = setTimeout(() => {
      _pendingRpc.delete(reqId);
      reject(new Error('RPC timeout: ' + type));
    }, 8000);
    _pendingRpc.set(reqId, { responseType: responseType || type, resolve, reject, timer });
    window.parent.postMessage({ type, data: Object.assign({ __reqId: reqId }, payload || {}) }, '*');
  });
}

function send(type, payload) {
  window.parent.postMessage({ type, data: payload || {} }, '*');
}
