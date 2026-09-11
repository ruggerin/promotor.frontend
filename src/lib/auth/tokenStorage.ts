// Único ponto de leitura/escrita do token no localStorage — o resto da app nunca toca
// localStorage diretamente, só fala com este módulo.
const STORAGE_KEY = 'pdv_admin_token';

export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  },
  set(token: string): void {
    localStorage.setItem(STORAGE_KEY, token);
  },
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
