'use strict';

const WebSocket = require('ws');
const { generateId, buildFindAllMessage, buildTxMessage, parseQueryResult } = require('../adapters/huly_adapter');

const TIMEOUT_MS = 30000;

class HulyConnection {
  constructor(endpoint, token) {
    this.endpoint = endpoint;
    this.token = token;
    this.ws = null;
    this._pending = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      const url = `${this.endpoint}/${this.token}`;
      this.ws = new WebSocket(url);

      const onOpen = () => {
        cleanup();
        this._attachMessageHandler();
        resolve();
      };

      const onError = (err) => {
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        this.ws.removeListener('open', onOpen);
        this.ws.removeListener('error', onError);
      };

      this.ws.on('open', onOpen);
      this.ws.on('error', onError);

      this.ws.on('close', () => {
        // Reject all pending on unexpected close
        for (const [id, pending] of this._pending) {
          clearTimeout(pending.timer);
          pending.reject(new Error('WebSocket closed unexpectedly'));
          this._pending.delete(id);
        }
      });
    });
  }

  _attachMessageHandler() {
    this.ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      const pending = this._pending.get(msg.id);
      if (!pending) return;

      clearTimeout(pending.timer);
      this._pending.delete(msg.id);

      if (msg.error) {
        pending.reject(new Error(typeof msg.error === 'object' ? JSON.stringify(msg.error) : msg.error));
      } else {
        pending.resolve(msg.result);
      }
    });
  }

  send(method, params) {
    return new Promise((resolve, reject) => {
      if (!this.isAlive()) {
        return reject(new Error('WebSocket is not connected'));
      }

      const id = generateId();
      let msg;

      if (method === 'findAll') {
        msg = buildFindAllMessage(id, params[0], params[1], params[2]);
      } else if (method === 'tx') {
        msg = buildTxMessage(id, params[0]);
      } else {
        msg = { id, method, params };
      }

      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`Request ${id} timed out after ${TIMEOUT_MS}ms`));
      }, TIMEOUT_MS);

      this._pending.set(id, { resolve, reject, timer });

      this.ws.send(JSON.stringify(msg), (err) => {
        if (err) {
          clearTimeout(timer);
          this._pending.delete(id);
          reject(err);
        }
      });
    });
  }

  async findAll(className, filter = {}, options = {}) {
    const raw = await this.send('findAll', [className, filter, options]);
    return parseQueryResult(raw);
  }

  async tx(txDoc) {
    return this.send('tx', [txDoc]);
  }

  isAlive() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  async reconnect() {
    if (this.ws) {
      try { this.ws.terminate(); } catch {}
      this.ws = null;
    }
    await this.connect();
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

module.exports = HulyConnection;
