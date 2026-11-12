'use strict';
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');
const { EventEmitter } = require('events');

/**
 * Verbindung zum dauerhaft laufenden PowerShell-Helfer.
 * Ein Prozess für alles – so muss PowerShell nur einmal starten.
 */
class Helper extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.nextId = 1;
    this.pending = new Map();
    this.readyPromise = null;
  }

  start() {
    if (process.platform !== 'win32') {
      this.readyPromise = Promise.resolve(false);
      return this.readyPromise;
    }
    const script = path.join(__dirname, '..', 'helper.ps1').replace('app.asar', 'app.asar.unpacked');
    this.proc = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.proc.stdin.setDefaultEncoding('utf8');
    let resolveReady;
    this.readyPromise = new Promise((r) => { resolveReady = r; });
    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on('line', (raw) => {
      const line = raw.replace(/^﻿/, '').trim();
      if (!line.startsWith('{')) return;
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      if (msg.event) { this.emit(msg.event, msg); return; }
      if (msg.id === 0) { resolveReady(true); return; }
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.ok) p.resolve(msg.data); else p.reject(new Error(msg.error || 'Helferfehler'));
    });
    this.proc.stderr.on('data', (d) => console.error('[helper]', d.toString()));
    this.proc.on('exit', (code) => {
      console.error('[helper] beendet mit Code', code);
      for (const p of this.pending.values()) p.reject(new Error('Helfer beendet'));
      this.pending.clear();
      this.proc = null;
      resolveReady(false);
    });
    setTimeout(() => resolveReady(false), 20000);
    return this.readyPromise;
  }

  async call(cmd, args = {}, timeoutMs = 15000) {
    const ok = await (this.readyPromise || this.start());
    if (!ok || !this.proc) throw new Error('Windows-Helfer nicht verfügbar');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Zeitüberschreitung bei ' + cmd));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.proc.stdin.write(JSON.stringify({ id, cmd, args }) + '\n');
    });
  }

  async safe(cmd, args, fallback = null, timeoutMs) {
    try { return await this.call(cmd, args, timeoutMs); } catch (e) { console.error('[helper]', cmd, e.message); return fallback; }
  }

  stop() {
    if (this.proc) { try { this.proc.kill(); } catch {} }
  }
}

module.exports = new Helper();
