import CameraAltIcon from '@mui/icons-material/CameraAlt';
import DownloadIcon from '@mui/icons-material/Download';
import ForumIcon from '@mui/icons-material/Forum';
import InventoryIcon from '@mui/icons-material/Inventory';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';
import { baixarCsv } from '../../lib/csv';
import {
  buscarOperacaoDoDia,
  type BlocoJornada,
  type LinhaEquipeOperacaoDoDia,
  type SituacaoPromotor,
  type TipoItemFilaAcoes,
} from '../../lib/api/operacaoDoDia';
import { OrdemServicoFormDialog } from '../ordensServico/OrdemServicoFormDialog';

// Painel "Operação do dia" — docs/32-PAINEL-OPERACAO-DO-DIA.md. Fase 2 (esta tela) consome o
// endpoint agregador da Fase 1 (GET /operacao-do-dia). "Mensagem à equipe" (Fase 4) segue
// desabilitado: a direção já foi fechada (reaproveitar o sino de notificações do doc 29), mas um
// detalhe do desenho ainda depende de o usuário completar uma frase que ficou cortada.

// Intervalo de polling — mesmo padrão do Painel de Atividades/Mapa ao Vivo (Fase 0 decisão 8).
// Fixo por enquanto; virar Parametro por empresa (como ATIVIDADES_POLLING_SEGUNDOS) é opcional,
// não bloqueia esta fase.
const POLLING_MS = 25_000;

const SITUACAO_LABEL: Record<SituacaoPromotor, string> = {
  NO_PDV: 'No PDV',
  DESLOCAMENTO: 'Deslocamento',
  ATRASADO: 'Atrasado',
  ENCERRADO: 'Encerrado',
};

const SITUACAO_COR: Record<SituacaoPromotor, string> = {
  NO_PDV: '#4f46e5',
  DESLOCAMENTO: '#0ea5e9',
  ATRASADO: '#f59e0b',
  ENCERRADO: '#9ca3af',
};

const TIPO_ACAO_COR: Record<TipoItemFilaAcoes, string> = {
  SINAL: '#dc2626',
  ALERTA: '#f59e0b',
  ATRASO: '#f59e0b',
};

const TIPO_ACAO_ICONE: Record<TipoItemFilaAcoes, React.ReactNode> = {
  SINAL: <WifiOffIcon fontSize="small" />,
  ALERTA: <ShoppingCartIcon fontSize="small" />,
  ATRASO: <ScheduleIcon fontSize="small" />,
};

const BLOCO_COR: Record<BlocoJornada['status'], string> = {
  FEITA: '#4f46e5',
  ATUAL: '#f59e0b',
  PREVISTA: 'transparent',
  ATRASO_INICIO: '#dc2626',
};

function horaFracionaria(horaMinuto: string): number {
  const [h, m] = horaMinuto.split(':').map(Number);
  return h + m / 60;
}

function horaFracionariaIso(iso: string): number {
  const data = new Date(iso);
  return data.getHours() + data.getMinutes() / 60;
}

function formatarHora(iso: string | null): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}

function minutosDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

function formatarDataHoraAgora(): string {
  const agora = new Date();
  const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dias[agora.getDay()]} ${pad(agora.getDate())}/${pad(agora.getMonth() + 1)} · ${pad(agora.getHours())}:${pad(agora.getMinutes())}`;
}

function faixaHoras(inicio: number, fim: number): number[] {
  const horas: number[] = [];
  for (let h = Math.floor(inicio); h <= Math.ceil(fim); h++) horas.push(h);
  return horas;
}

function exportarEquipeCsv(equipe: LinhaEquipeOperacaoDoDia[]): void {
  const linhas = equipe.map((linha) => [
    linha.usuario.nome,
    SITUACAO_LABEL[linha.status],
    linha.ponto_venda_atual?.fantasia ?? '',
    formatarHora(linha.checkin_em) ?? '',
    `${linha.visitas.feitas}/${linha.visitas.total}`,
    linha.rupturas,
    linha.ultima_localizacao_em ? `${minutosDesde(linha.ultima_localizacao_em)} min` : 'sem sinal',
  ]);
  baixarCsv(
    `operacao-do-dia-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Promotor', 'Situação', 'PDV atual', 'Check-in', 'Visitas', 'Rupturas', 'Sinal'],
    linhas,
  );
}

export function OperacaoDoDiaPage() {
  const queryClient = useQueryClient();
  const [novaTarefaAberta, setNovaTarefaAberta] = useState(false);

  const cabecalho = usePageHeader(
    <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
      Operação do dia
    </Typography>,
  );

  const query = useQuery({
    queryKey: ['operacao-do-dia'],
    queryFn: buscarOperacaoDoDia,
    refetchInterval: POLLING_MS,
    placeholderData: keepPreviousData,
  });

  if (query.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (query.isError || !query.data) {
    return <Alert severity="error">Não foi possível carregar a operação do dia.</Alert>;
  }

  const dados = query.data;
  const { kpis, equipe, fila_acoes: filaAcoes, rupturas_por_sku: rupturasPorSku } = dados;

  const jornadaInicioHora = horaFracionaria(dados.jornada.inicio);
  const jornadaFimHora = horaFracionaria(dados.jornada.fim);
  const totalHoras = Math.max(1, jornadaFimHora - jornadaInicioHora);
  const agoraHora = new Date().getHours() + new Date().getMinutes() / 60;
  const ritmoDia = Math.min(100, Math.max(0, Math.round(((agoraHora - jornadaInicioHora) / totalHoras) * 100)));
  const pctVisitas = kpis.visitas_realizadas.total
    ? Math.round((kpis.visitas_realizadas.feitas / kpis.visitas_realizadas.total) * 100)
    : 0;

  return (
    <Box>
      {cabecalho}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          {formatarDataHoraAgora()} · jornada {dados.jornada.inicio}–{dados.jornada.fim}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => exportarEquipeCsv(equipe)}>
            Exportar
          </Button>
          <Tooltip title="Ainda não implementado — depende de fechar o desenho da Fase 4 (ver docs/32-PAINEL-OPERACAO-DO-DIA.md)">
            <span>
              <Button variant="outlined" size="small" startIcon={<ForumIcon />} disabled>
                Mensagem à equipe
              </Button>
            </span>
          </Tooltip>
          <Button variant="contained" size="small" startIcon={<PlaylistAddIcon />} onClick={() => setNovaTarefaAberta(true)}>
            Nova tarefa
          </Button>
        </Box>
      </Box>

      {/* KPIs */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1.5, mb: 2 }}>
        <Paper sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            VISITAS REALIZADAS
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            {kpis.visitas_realizadas.feitas}/{kpis.visitas_realizadas.total}{' '}
            <Typography component="span" variant="body2" color="text.secondary">
              {pctVisitas}%
            </Typography>
          </Typography>
          <LinearProgress variant="determinate" value={pctVisitas} sx={{ mt: 0.5, mb: 0.5, height: 5, borderRadius: 5 }} />
          <Typography variant="caption" color="text.secondary">ritmo do dia {ritmoDia}%</Typography>
        </Paper>
        <Paper sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            EM CAMPO
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{kpis.em_campo.atual}/{kpis.em_campo.total}</Typography>
          <Typography variant="caption" color="text.secondary">{kpis.em_campo.encerrados} encerrado(s)</Typography>
        </Paper>
        <Paper sx={{ p: 1.5, borderLeft: kpis.atrasados > 0 ? '3px solid #f59e0b' : undefined }}>
          <Typography variant="caption" color="text.secondary">
            ATRASADOS
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: kpis.atrasados > 0 ? '#b45309' : undefined }}>
            {kpis.atrasados}
          </Typography>
          <Typography variant="caption" color="text.secondary">check-in fora do previsto</Typography>
        </Paper>
        <Paper sx={{ p: 1.5, borderLeft: kpis.sem_sinal > 0 ? '3px solid #dc2626' : undefined }}>
          <Typography variant="caption" color="text.secondary">
            SEM SINAL
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: kpis.sem_sinal > 0 ? '#dc2626' : undefined }}>
            {kpis.sem_sinal}
          </Typography>
          <Typography variant="caption" color="text.secondary">sem GPS recente</Typography>
        </Paper>
        <Paper sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            RUPTURAS ABERTAS
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{kpis.rupturas_abertas.total}</Typography>
          <Typography variant="caption" color="text.secondary">em {kpis.rupturas_abertas.pdvs} PDVs</Typography>
        </Paper>
        <Paper sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            FORMULÁRIOS EMITIDOS
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {kpis.formularios_emitidos.preenchidos}/{kpis.formularios_emitidos.expedidos}
          </Typography>
          <Typography variant="caption" color="text.secondary">preenchidos hoje</Typography>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2, mb: 2, alignItems: 'start' }}>
        {/* Equipe em campo */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Equipe em campo <Chip label={equipe.length} size="small" sx={{ ml: 1 }} />
          </Typography>
          {equipe.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Nenhum compromisso pra hoje.</Typography>
          ) : (
            <TableContainer sx={{ maxHeight: 300, overflowY: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Promotor</TableCell>
                    <TableCell>PDV atual</TableCell>
                    <TableCell>Check-in</TableCell>
                    <TableCell>Visitas</TableCell>
                    <TableCell align="right">Rupt.</TableCell>
                    <TableCell align="right">Sinal</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {equipe.map((linha) => {
                    const sinalMin = minutosDesde(linha.ultima_localizacao_em);
                    return (
                      <TableRow key={linha.usuario.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: SITUACAO_COR[linha.status], flexShrink: 0 }} />
                            <UsuarioAvatar nome={linha.usuario.nome} fotoUrl={linha.usuario.foto_url} size={24} />
                            <Box>
                              <Typography variant="body2">{linha.usuario.nome}</Typography>
                              <Typography variant="caption" color="text.secondary">{SITUACAO_LABEL[linha.status]}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {linha.ponto_venda_atual?.fantasia ?? (
                            <Typography color="text.secondary" variant="body2">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>{formatarHora(linha.checkin_em) ?? '—'}</TableCell>
                        <TableCell sx={{ minWidth: 90 }}>
                          <Typography variant="caption">{linha.visitas.feitas}/{linha.visitas.total}</Typography>
                          <LinearProgress
                            variant="determinate"
                            value={linha.visitas.total ? (linha.visitas.feitas / linha.visitas.total) * 100 : 0}
                            sx={{ height: 4, borderRadius: 4, mt: 0.3 }}
                          />
                        </TableCell>
                        <TableCell align="right">{linha.rupturas || '—'}</TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{ color: linha.sem_sinal ? '#dc2626' : 'text.secondary', fontWeight: linha.sem_sinal ? 700 : 400 }}
                          >
                            {sinalMin === null ? '—' : `${sinalMin} min`}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* Fila de ações */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Fila de ações <Chip label={filaAcoes.length} size="small" sx={{ ml: 1 }} />
          </Typography>
          {filaAcoes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Nada pendente agora.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 300, overflowY: 'auto', pr: 0.5 }}>
              {filaAcoes.map((item, i) => (
                <Box
                  key={i}
                  sx={{
                    borderLeft: `3px solid ${TIPO_ACAO_COR[item.tipo]}`,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    p: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: TIPO_ACAO_COR[item.tipo] }}>
                    {TIPO_ACAO_ICONE[item.tipo]}
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {item.tipo}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Typography variant="caption" color="text.secondary">{formatarHora(item.ocorrido_em) ?? ''}</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.3 }}>{item.titulo}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[item.ponto_venda?.fantasia, item.usuario?.nome].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2 }}>
        {/* Jornada (Gantt) */}
        <Paper sx={{ p: 2, overflowX: 'auto' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Jornada
          </Typography>
          {equipe.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Nenhum compromisso pra hoje.</Typography>
          ) : (
            <>
              <Box sx={{ minWidth: 640 }}>
                <Box sx={{ display: 'flex', pl: '110px', mb: 0.5, position: 'relative' }}>
                  {faixaHoras(jornadaInicioHora, jornadaFimHora).map((h) => (
                    <Box key={h} sx={{ flex: 1, fontSize: 11, color: 'text.secondary' }}>
                      {String(h).padStart(2, '0')}h
                    </Box>
                  ))}
                </Box>
                {equipe.map((linha) => (
                  <Box key={linha.usuario.id} sx={{ display: 'flex', alignItems: 'center', height: 26, position: 'relative' }}>
                    <Typography variant="caption" sx={{ width: 110, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pr: 1 }}>
                      {linha.usuario.nome}
                    </Typography>
                    <Box sx={{ position: 'relative', flexGrow: 1, height: 16, bgcolor: 'action.hover', borderRadius: 0.5 }}>
                      {linha.blocos_jornada.map((bloco, i) => {
                        const inicioHora = horaFracionariaIso(bloco.inicio);
                        const fimHora = Math.max(inicioHora, horaFracionariaIso(bloco.fim));
                        const esquerda = ((inicioHora - jornadaInicioHora) / totalHoras) * 100;
                        const largura = Math.max(0.5, ((fimHora - inicioHora) / totalHoras) * 100);
                        return (
                          <Tooltip key={i} title={bloco.status.replaceAll('_', ' ')}>
                            <Box
                              sx={{
                                position: 'absolute',
                                left: `${esquerda}%`,
                                width: `${largura}%`,
                                top: 0,
                                bottom: 0,
                                bgcolor: BLOCO_COR[bloco.status],
                                border: bloco.status === 'PREVISTA' ? '1px dashed #9ca3af' : 'none',
                                borderRadius: 0.5,
                              }}
                            />
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </Box>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, bgcolor: '#4f46e5', borderRadius: 0.5, mr: 0.5 }} />
                visita feita
                <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, bgcolor: '#f59e0b', borderRadius: 0.5, mx: 0.5, ml: 1.5 }} />
                no PDV agora
                <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, border: '1px dashed #9ca3af', borderRadius: 0.5, mx: 0.5, ml: 1.5 }} />
                prevista
                <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, bgcolor: '#dc2626', borderRadius: 0.5, mx: 0.5, ml: 1.5 }} />
                atraso no início
              </Typography>
            </>
          )}
        </Paper>

        {/* Rupturas por SKU */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <InventoryIcon fontSize="small" /> Rupturas por SKU
          </Typography>
          {rupturasPorSku.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Nenhuma ruptura aberta.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Cód.</TableCell>
                    <TableCell>Produto</TableCell>
                    <TableCell align="right">PDVs</TableCell>
                    <TableCell align="right">Desde</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rupturasPorSku.map((linha) => (
                    <TableRow key={linha.produto.id} hover>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{linha.produto.codigo_barras ?? '—'}</Typography>
                      </TableCell>
                      <TableCell>{linha.produto.descricao}</TableCell>
                      <TableCell align="right">{linha.pdvs}</TableCell>
                      <TableCell align="right">
                        <Tooltip title={new Date(linha.desde).toLocaleString('pt-BR')}>
                          <span>{formatarHora(linha.desde)}</span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      <OrdemServicoFormDialog
        open={novaTarefaAberta}
        ordemServico={null}
        onClose={() => {
          setNovaTarefaAberta(false);
          void queryClient.invalidateQueries({ queryKey: ['operacao-do-dia'] });
        }}
      />
    </Box>
  );
}
