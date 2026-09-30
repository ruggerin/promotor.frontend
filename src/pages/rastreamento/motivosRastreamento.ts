// Rótulo de cada motivo de o rastreamento não estar rodando (docs/47-RASTREAMENTO-EXIGENCIA.md) —
// compartilhado entre a lista de promotores do Mapa ao vivo e o painel "Rastreamento irregular".
export const MOTIVO_RASTREAMENTO: Record<string, string> = {
  SEM_PERMISSAO: 'Sem permissão de localização',
  SO_DURANTE_USO: 'Permissão só “durante o uso”',
  GPS_DESLIGADO: 'GPS do celular desligado',
  DESLIGADO_PELO_PROMOTOR: 'Pausou o compartilhamento',
  NAO_SUPORTADO: 'Usando Expo Go (sem rastreamento)',
  FALHA_AO_INICIAR: 'Falha ao ligar o rastreamento',
  SEM_SINAL: 'Sem sinal',
  NUNCA_INFORMOU: 'Nunca abriu o app com o rastreamento',
};
