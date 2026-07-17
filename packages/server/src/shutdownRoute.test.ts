import { describe, expect, test } from 'bun:test';
import { isLoopbackHost, shouldHonorShutdown } from './shutdownRoute';

describe('isLoopbackHost', () => {
  test('the loopback spellings are loopback', () => {
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('::1')).toBe(true);
  });
  test('a LAN / wildcard bind is not loopback', () => {
    expect(isLoopbackHost('0.0.0.0')).toBe(false);
    expect(isLoopbackHost('192.168.1.20')).toBe(false);
  });
});

describe('shouldHonorShutdown (v0.38.5)', () => {
  test('POST /shutdown on a loopback-bound server → honored', () => {
    expect(shouldHonorShutdown('POST', '/shutdown', '127.0.0.1')).toBe(true);
    expect(shouldHonorShutdown('POST', '/shutdown', 'localhost')).toBe(true);
  });
  test('a LAN-exposed server never honors a remote shutdown', () => {
    expect(shouldHonorShutdown('POST', '/shutdown', '0.0.0.0')).toBe(false);
  });
  test('wrong method or path → ignored', () => {
    expect(shouldHonorShutdown('GET', '/shutdown', '127.0.0.1')).toBe(false);
    expect(shouldHonorShutdown('POST', '/shutdownx', '127.0.0.1')).toBe(false);
    expect(shouldHonorShutdown('POST', '/', '127.0.0.1')).toBe(false);
  });
});
