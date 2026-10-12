import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroidOutlined';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Switch, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import {
  aprovarSolicitacaoAparelho,
  buscarAcessoApp,
  definirLicencaMobile,
  liberarTrocaAparelho,
  recusarSolicitacaoAparelho,
} from '../../lib/api/licencas';
import { revogarDispositivoUsuario } from '../../lib/api/usuarios';
import { dataHora, nomePlataforma, ORIGEM_VINCULO, tagIntegridade, textoUltimoUso } from '../../lib/licencas';
import type { Usuario } from '../../types/api';

// Seção "Acesso ao app mobile" do usuário (docs/67 §3, protótipo aprovado em 12/10/2026): licença
// do app, pedido de liberação pendente e o aparelho vinculado com as ações.

function mensagemDoErro(err: unknown, padrao: string): string {
  return axios.isAxiosError<{ message?: string }>(err) && err.response?.data?.message ? err.response.data.message : padrao;
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {rotulo}
      </Typography>
      <Typography variant="body2" component="div">
        {children}
      </Typography>
    </Box>
  );
}

export function AcessoAppPanel({ usuario }: { usuario: Usuario }) {
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const acessoQuery = useQuery({
    queryKey: ['usuarios', usuario.id, 'acesso-app'],
    queryFn: () => buscarAcessoApp(usuario.id),
  });

  function atualizar() {
    void queryClient.invalidateQueries({ queryKey: ['usuarios', usuario.id] });
    void queryClient.invalidateQueries({ queryKey: ['licencas'] });
  }

  const acao = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
    onError: (err) => setAviso({ tipo: 'error', texto: mensagemDoErro(err, 'Não foi possível concluir a ação.') }),
  });

  function executar(fn: () => Promise<void>, sucesso: string, confirmacao?: string) {
    if (confirmacao && !window.confirm(confirmacao)) return;
    setAviso(null);
    acao.mutate(fn, {
      onSuccess: () => {
        setAviso({ tipo: 'success', texto: sucesso });
        atualizar();
      },
    });
  }

  const dados = acessoQuery.data;
  const primeiroNome = usuario.nome.split(' ')[0];
  const uso = dados?.uso;
  const limiteCheio =
    dados && !dados.licenca_mobile && uso?.licencas_limite != null && uso.licencas_usadas >= uso.licencas_limite;
  const ocupado = acao.isPending;

  return (
    <Paper>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            bgcolor: 'primary.light',
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PhoneAndroidIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontSize: 15 }}>
            Acesso ao app mobile
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Licença e aparelho vinculado
          </Typography>
        </Box>
      </Box>

      {acessoQuery.isLoading || !dados ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          {acessoQuery.isError ? (
            <Typography color="error">Não foi possível carregar o acesso ao app.</Typography>
          ) : (
            <CircularProgress size={24} />
          )}
        </Box>
      ) : (
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 500 }}>Licença do app mobile</Typography>
              <Typography variant="body2" color="text.secondary">
                {dados.licenca_mobile
                  ? uso?.licencas_limite != null
                    ? `Usa 1 de ${uso.licencas_limite} licenças contratadas · ${uso.licencas_usadas} em uso na empresa`
                    : 'Usa 1 licença · empresa sem limite de licenças'
                  : uso?.licencas_limite != null
                    ? `Desligada · ${uso.licencas_disponiveis ?? 0} de ${uso.licencas_limite} licenças disponíveis`
                    : 'Desligada · empresa sem limite de licenças'}
              </Typography>
              {limiteCheio && (
                <Typography variant="body2" sx={{ color: 'warning.main' }}>
                  Limite de {uso?.licencas_limite} licenças atingido. Fale com o suporte para contratar mais.
                </Typography>
              )}
            </Box>
            <Switch
              checked={dados.licenca_mobile}
              disabled={ocupado || Boolean(limiteCheio)}
              slotProps={{ input: { 'aria-label': 'Licença do app mobile' } }}
              onChange={(e) => {
                const ligar = e.target.checked;
                executar(
                  () => definirLicencaMobile(usuario.id, ligar),
                  ligar ? `${primeiroNome} já pode entrar no app.` : 'Licença removida e app desconectado.',
                  ligar
                    ? undefined
                    : `Remover a licença de ${usuario.nome}? O aparelho é desvinculado e o app é desconectado na hora.`,
                );
              }}
            />
          </Box>

          {aviso && (
            <Alert severity={aviso.tipo} onClose={() => setAviso(null)}>
              {aviso.texto}
            </Alert>
          )}

          {!dados.licenca_mobile && (
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', color: 'text.secondary' }}>
              <Typography variant="body2">
                Sem licença, este usuário não consegue entrar no app. O admin web continua liberado conforme o perfil.
              </Typography>
            </Box>
          )}

          {dados.licenca_mobile && dados.solicitacao && (
            <Box sx={{ p: 1.75, borderRadius: 1.5, bgcolor: 'warning.light', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', color: 'warning.dark' }}>
                <ErrorOutlineIcon fontSize="small" sx={{ mt: '1px' }} />
                <Typography variant="body2">
                  {primeiroNome} tentou entrar num <strong>{dados.solicitacao.aparelho ?? 'aparelho novo'}</strong>{' '}
                  {textoUltimoUso(dados.solicitacao.pedido_em)}.
                  {dados.proxima_troca_propria_em
                    ? ` A troca própria da semana já foi usada; a próxima vale a partir de ${new Date(dados.proxima_troca_propria_em).toLocaleDateString('pt-BR')}.`
                    : ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={ocupado}
                  onClick={() =>
                    executar(
                      () => recusarSolicitacaoAparelho(dados.solicitacao!.uuid),
                      `Pedido recusado. ${dados.dispositivo?.nome ?? 'O aparelho atual'} continua sendo o aparelho de ${primeiroNome}.`,
                    )
                  }
                >
                  Recusar
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  disabled={ocupado}
                  onClick={() =>
                    executar(
                      () => aprovarSolicitacaoAparelho(dados.solicitacao!.uuid),
                      `${dados.solicitacao!.aparelho ?? 'Aparelho'} liberado. O aparelho anterior foi desconectado; o próximo login no aparelho liberado o vincula.`,
                    )
                  }
                >
                  Liberar aparelho
                </Button>
              </Box>
            </Box>
          )}

          {dados.licenca_mobile && dados.dispositivo && (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.default' }}>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  px: 2,
                  py: 1.75,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Aparelho vinculado
                  </Typography>
                  <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{dados.dispositivo.nome ?? 'Aparelho sem nome'}</Typography>
                </Box>
                <Chip
                  label={tagIntegridade(dados.dispositivo.integridade_status).rotulo}
                  color={tagIntegridade(dados.dispositivo.integridade_status).cor}
                  size="small"
                />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 16px', px: 2, py: 1.75 }}>
                <Dado rotulo="Sistema">{nomePlataforma(dados.dispositivo.plataforma, dados.dispositivo.versao_so) ?? '—'}</Dado>
                <Dado rotulo="Versão do app">{dados.dispositivo.versao_app ?? '—'}</Dado>
                <Dado rotulo="Vinculado em">
                  {dataHora(dados.dispositivo.vinculado_em)} · {ORIGEM_VINCULO[dados.dispositivo.origem]}
                </Dado>
                <Dado rotulo="Último uso">
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                    <Box
                      component="span"
                      sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: dados.dispositivo.online ? 'success.main' : 'text.disabled' }}
                    />
                    {textoUltimoUso(dados.dispositivo.ultimo_uso_em)}
                  </Box>
                </Dado>
                <Dado rotulo="Trocas em 30 dias">{dados.trocas_aparelho_30d}</Dado>
                <Dado rotulo="Próxima troca própria">
                  {dados.troca_liberada
                    ? 'liberada pelo gestor'
                    : dados.proxima_troca_propria_em
                      ? `a partir de ${new Date(dados.proxima_troca_propria_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
                      : 'disponível'}
                </Dado>
              </Box>
              <Box
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end', px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  disabled={ocupado || dados.troca_liberada}
                  onClick={() =>
                    executar(
                      () => liberarTrocaAparelho(usuario.id),
                      `Nova troca liberada. Se ${primeiroNome} entrar em outro celular, ele é vinculado sem pedir aprovação.`,
                    )
                  }
                >
                  {dados.troca_liberada ? 'Troca já liberada' : 'Liberar nova troca'}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  disabled={ocupado}
                  onClick={() =>
                    executar(
                      () => revogarDispositivoUsuario(usuario.id),
                      'Aparelho desvinculado e sessão encerrada.',
                      `Desvincular o aparelho de ${usuario.nome}? O app é desconectado na hora; o próximo celular em que entrar fica vinculado.`,
                    )
                  }
                >
                  Desvincular aparelho
                </Button>
              </Box>
            </Box>
          )}

          {dados.licenca_mobile && !dados.dispositivo && (
            <Box sx={{ px: 2, py: 1.75, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1.5, color: 'text.secondary' }}>
              <Typography variant="body2">
                Nenhum aparelho vinculado. O primeiro celular em que {primeiroNome} entrar no app fica vinculado.
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
}
