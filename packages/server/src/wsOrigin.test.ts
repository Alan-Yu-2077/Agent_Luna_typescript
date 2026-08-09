import { describe, expect, test } from 'bun:test';
import { extraAllowedOrigins, isLoopbackOrigin, wsOriginAllowed } from './wsOrigin';
import { soulWriteAllowed } from './data/dataApi';

// v0.45.15 (Initiative 37, A2/A3) — the two gates that turn "loopback bind" from a slogan into a
// boundary. A browser cannot forge Origin; that is the whole security argument, so these tests
// pin exactly which origins get in.

describe('wsOriginAllowed (A2 — the CSWSH gate)', () => {
  test('no Origin at all → allowed (native clients, the smoke harness, curl)', () => {
    expect(wsOriginAllowed(null)).toBe(true);
    expect(wsOriginAllowed(undefined)).toBe(true);
    expect(wsOriginAllowed('')).toBe(true);
  });

  test("our own web surfaces on loopback → allowed, whatever the port", () => {
    for (const o of [
      'http://localhost:5173', // dev
      'http://127.0.0.1:5177', // packaged
      'http://127.0.0.1:5178', // smoke
      'http://localhost:5299', // workbench
      'http://[::1]:5173',
      'https://127.0.0.1:8443',
    ]) {
      expect(wsOriginAllowed(o)).toBe(true);
    }
  });

  test('a page from anywhere else → refused (this is the attack)', () => {
    for (const o of [
      'http://evil.example',
      'https://evil.example',
      'http://192.168.1.50:5173', // LAN, not this machine
      'http://localhost.evil.example', // suffix trick
      'http://127.0.0.1.evil.example',
      'null', // sandboxed / file:// page
      'not a url',
    ]) {
      expect(wsOriginAllowed(o)).toBe(false);
    }
  });

  test('explicitly trusted extras are exact matches only', () => {
    const extras = extraAllowedOrigins('https://studio.example, http://tauri.localhost');
    expect(extras).toEqual(['https://studio.example', 'http://tauri.localhost']);
    expect(wsOriginAllowed('https://studio.example', extras)).toBe(true);
    expect(wsOriginAllowed('https://studio.example.evil', extras)).toBe(false);
    expect(extraAllowedOrigins(undefined)).toEqual([]);
    expect(extraAllowedOrigins('  ')).toEqual([]);
  });

  test('isLoopbackOrigin rejects non-http schemes', () => {
    expect(isLoopbackOrigin('file://127.0.0.1')).toBe(false);
    expect(isLoopbackOrigin('ws://127.0.0.1:8787')).toBe(false);
  });
});

describe('soulWriteAllowed (A3 — parity with /shutdown, plus the CSRF half)', () => {
  test('loopback bind + no/loopback Origin → allowed', () => {
    expect(soulWriteAllowed(null, '127.0.0.1')).toBe(true);
    expect(soulWriteAllowed('http://127.0.0.1:5177', 'localhost')).toBe(true);
    expect(soulWriteAllowed(null, '::1')).toBe(true);
  });

  test('a LAN-exposed instance refuses the write outright (the /shutdown rule)', () => {
    expect(soulWriteAllowed(null, '0.0.0.0')).toBe(false);
    expect(soulWriteAllowed('http://127.0.0.1:5177', '192.168.1.10')).toBe(false);
  });

  test('a foreign page cannot overwrite her core even on a loopback bind', () => {
    expect(soulWriteAllowed('http://evil.example', '127.0.0.1')).toBe(false);
    expect(soulWriteAllowed('null', '127.0.0.1')).toBe(false);
  });
});
