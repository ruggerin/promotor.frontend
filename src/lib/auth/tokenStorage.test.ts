import { beforeEach, describe, expect, it } from 'vitest';
import { tokenStorage } from './tokenStorage';

describe('tokenStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('retorna null quando não há token salvo', () => {
    expect(tokenStorage.get()).toBeNull();
  });

  it('grava e lê o token', () => {
    tokenStorage.set('abc123');
    expect(tokenStorage.get()).toBe('abc123');
  });

  it('limpa o token', () => {
    tokenStorage.set('abc123');
    tokenStorage.clear();
    expect(tokenStorage.get()).toBeNull();
  });
});
