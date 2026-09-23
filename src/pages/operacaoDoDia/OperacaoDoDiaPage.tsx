import CameraAltIcon from '@mui/icons-material/CameraAlt';
import DownloadIcon from '@mui/icons-material/Download';
import ForumIcon from '@mui/icons-material/Forum';
import InventoryIcon from '@mui/icons-material/Inventory';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import {
  Box,
  Button,
  Chip,
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
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';

// PROTÓTIPO — só pra validar layout/informação com o usuário antes de implementar de verdade
// (ver docs/32-PAINEL-OPERACAO-DO-DIA.md). Tudo abaixo é dado fixo, nenhuma chamada à API, nada
// clicável de verdade. Apagar/substituir por dado real quando a Fase 1/2 do doc 32 for pra
// frente.

type SituacaoPromotor = 'NO_PDV' | 'DESLOCAMENTO' | 'ATRASADO' | 'SEM_SINAL' | 'ENCERRADO';

const SITUACAO_LABEL: Record<SituacaoPromotor, string> = {
  NO_PDV: 'No PDV',
  DESLOCAMENTO: 'Deslocamento',
  ATRASADO: 'Atrasado',
  SEM_SINAL: 'Sem sinal',
  ENCERRADO: 'Encerrado',
};

const SITUACAO_COR: Record<SituacaoPromotor, string> = {
  NO_PDV: '#4f46e5',
  DESLOCAMENTO: '#0ea5e9',
  ATRASADO: '#f59e0b',
  SEM_SINAL: '#dc2626',
  ENCERRADO: '#9ca3af',
};

interface LinhaEquipe {
  nome: string;
  situacao: SituacaoPromotor;
  pdvAtual: string | null;
  checkin: string | null;
  visitasFeitas: number;
  visitasTotal: number;
  rupturas: number;
  sinalMinutos: number;
}

const equipe: LinhaEquipe[] = [
  { nome: 'Fábio Mendes', situacao: 'SEM_SINAL', pdvAtual: null, checkin: null, visitasFeitas: 0, visitasTotal: 6, rupturas: 0, sinalMinutos: 58 },
  { nome: 'Diego Ferreira', situacao: 'ATRASADO', pdvAtual: 'Atacarejo Rio Negro', checkin: '08:47', visitasFeitas: 2, visitasTotal: 8, rupturas: 3, sinalMinutos: 5 },
  { nome: 'João Victor Alves', situacao: 'NO_PDV', pdvAtual: 'Hiper Ponta Negra', checkin: '09:12', visitasFeitas: 1, visitasTotal: 7, rupturas: 0, sinalMinutos: 3 },
  { nome: 'Adriana Souza', situacao: 'NO_PDV', pdvAtual: 'Supermercado Nova Era', checkin: '07:42', visitasFeitas: 5, visitasTotal: 8, rupturas: 2, sinalMinutos: 2 },
  { nome: 'Bruno Lima', situacao: 'NO_PDV', pdvAtual: 'Mercantil Sol Nascente', checkin: '07:55', visitasFeitas: 4, visitasTotal: 7, rupturas: 0, sinalMinutos: 1 },
  { nome: 'Elaine Castro', situacao: 'NO_PDV', pdvAtual: 'Mercadinho Bom Preço', checkin: '07:38', visitasFeitas: 5, visitasTotal: 7, rupturas: 1, sinalMinutos: 6 },
  { nome: 'Gisele Rocha', situacao: 'NO_PDV', pdvAtual: 'Supermercado Vitória Régia', checkin: '07:50', visitasFeitas: 7, visitasTotal: 8, rupturas: 1, sinalMinutos: 1 },
  { nome: 'Ingrid Paiva', situacao: 'NO_PDV', pdvAtual: 'Atacarejo Parque Dez', checkin: '07:40', visitasFeitas: 6, visitasTotal: 8, rupturas: 4, sinalMinutos: 1 },
  { nome: 'Luan Pires', situacao: 'NO_PDV', pdvAtual: 'Mercantil Beira-Rio', checkin: '07:58', visitasFeitas: 4, visitasTotal: 8, rupturas: 2, sinalMinutos: 2 },
  { nome: 'Carla Nogueira', situacao: 'DESLOCAMENTO', pdvAtual: 'Mercantil Centro Velho', checkin: '07:31', visitasFeitas: 6, visitasTotal: 9, rupturas: 1, sinalMinutos: 4 },
  { nome: 'Hugo Barbosa', situacao: 'DESLOCAMENTO', pdvAtual: 'Supermercado Cachoeirinha', checkin: '08:05', visitasFeitas: 3, visitasTotal: 8, rupturas: 1, sinalMinutos: 5 },
  { nome: 'Kátia Moraes', situacao: 'ENCERRADO', pdvAtual: 'Roteiro concluído', checkin: '07:35', visitasFeitas: 6, visitasTotal: 6, rupturas: 0, sinalMinutos: 12 },
];

type TipoAcao = 'SINAL' | 'RUPTURA' | 'ATRASO' | 'FORMULARIO';

const TIPO_ACAO_COR: Record<TipoAcao, string> = {
  SINAL: '#dc2626',
  RUPTURA: '#f59e0b',
  ATRASO: '#f59e0b',
  FORMULARIO: '#4f46e5',
};

const TIPO_ACAO_ICONE: Record<TipoAcao, React.ReactNode> = {
  SINAL: <WifiOffIcon fontSize="small" />,
  RUPTURA: <ShoppingCartIcon fontSize="small" />,
  ATRASO: <ScheduleIcon fontSize="small" />,
  FORMULARIO: <CameraAltIcon fontSize="small" />,
};

interface ItemFila {
  tipo: TipoAcao;
  titulo: string;
  subtitulo: string;
  horario: string;
  acoes: string[];
}

const filaAcoes: ItemFila[] = [
  { tipo: 'SINAL', titulo: 'Fábio Mendes sem sinal há 58 min', subtitulo: 'R-09 Tarumã · 0/6 visitas', horario: '10:41', acoes: ['Ligar', 'Resolver'] },
  { tipo: 'RUPTURA', titulo: 'Café torrado 500g zerado na gôndola', subtitulo: 'Atacarejo Parque Dez · Ingrid Paiva', horario: '10:32', acoes: ['Abrir pedido', 'Resolver'] },
  { tipo: 'ATRASO', titulo: 'João Victor: check-in 1h42 após o previsto', subtitulo: 'Hiper Ponta Negra · R-08', horario: '09:12', acoes: ['Justificar', 'Resolver'] },
  { tipo: 'FORMULARIO', titulo: 'Checklist "Loja Perfeita" aguardando revisão', subtitulo: 'Atacarejo Rio Negro · Diego Ferreira', horario: '10:18', acoes: ['Ver formulário', 'Resolver'] },
  { tipo: 'RUPTURA', titulo: 'Óleo de soja 900ml sem estoque na loja', subtitulo: 'Supermercado Nova Era · Adriana Souza', horario: '09:58', acoes: ['Abrir pedido', 'Resolver'] },
  { tipo: 'ATRASO', titulo: 'Diego Ferreira: check-in 1h17 após o previsto', subtitulo: 'Atacarejo Rio Negro · R-12', horario: '08:47', acoes: ['Justificar', 'Resolver'] },
];

interface BlocoJornada {
  inicioHora: number;
  fimHora: number;
  status: 'FEITA' | 'ATUAL' | 'PREVISTA' | 'ATRASO_INICIO';
}

interface LinhaJornada {
  nome: string;
  blocos: BlocoJornada[];
}

const jornada: LinhaJornada[] = [
  { nome: 'Fábio Mendes', blocos: [{ inicioHora: 7, fimHora: 8, status: 'ATRASO_INICIO' }] },
  { nome: 'Diego Ferreira', blocos: [{ inicioHora: 8.5, fimHora: 10.5, status: 'ATUAL' }, { inicioHora: 10.5, fimHora: 13, status: 'PREVISTA' }] },
  { nome: 'João Victor Alves', blocos: [{ inicioHora: 7.5, fimHora: 9, status: 'FEITA' }, { inicioHora: 9, fimHora: 10.7, status: 'ATUAL' }] },
  { nome: 'Adriana Souza', blocos: [{ inicioHora: 7.7, fimHora: 10.7, status: 'FEITA' }, { inicioHora: 10.7, fimHora: 13, status: 'ATUAL' }] },
  { nome: 'Bruno Lima', blocos: [{ inicioHora: 7.9, fimHora: 10.7, status: 'FEITA' }, { inicioHora: 10.7, fimHora: 12.5, status: 'ATUAL' }] },
  { nome: 'Elaine Castro', blocos: [{ inicioHora: 7.6, fimHora: 10.7, status: 'FEITA' }, { inicioHora: 10.7, fimHora: 13.5, status: 'ATUAL' }] },
  { nome: 'Gisele Rocha', blocos: [{ inicioHora: 7.8, fimHora: 10.7, status: 'FEITA' }, { inicioHora: 10.7, fimHora: 12, status: 'ATUAL' }] },
  { nome: 'Ingrid Paiva', blocos: [{ inicioHora: 7.7, fimHora: 10.7, status: 'FEITA' }, { inicioHora: 10.7, fimHora: 13.2, status: 'ATUAL' }] },
  { nome: 'Luan Pires', blocos: [{ inicioHora: 8, fimHora: 10.7, status: 'FEITA' }, { inicioHora: 10.7, fimHora: 12.8, status: 'ATUAL' }] },
  { nome: 'Carla Nogueira', blocos: [{ inicioHora: 7.5, fimHora: 10.7, status: 'FEITA' }, { inicioHora: 10.7, fimHora: 12, status: 'PREVISTA' }] },
  { nome: 'Hugo Barbosa', blocos: [{ inicioHora: 8.1, fimHora: 10.7, status: 'FEITA' }, { inicioHora: 10.7, fimHora: 13.3, status: 'PREVISTA' }] },
  { nome: 'Kátia Moraes', blocos: [{ inicioHora: 7.6, fimHora: 10.6, status: 'FEITA' }] },
];

const BLOCO_COR: Record<BlocoJornada['status'], string> = {
  FEITA: '#4f46e5',
  ATUAL: '#f59e0b',
  PREVISTA: 'transparent',
  ATRASO_INICIO: '#dc2626',
};

interface LinhaRupturaSku {
  codigo: string;
  produto: string;
  pdvs: number;
  desde: string;
}

const rupturasPorSku: LinhaRupturaSku[] = [
  { codigo: '7891.0231', produto: 'Café torrado 500g', pdvs: 4, desde: '2 dias' },
  { codigo: '7894.1177', produto: 'Arroz tipo 1 5kg', pdvs: 2, desde: '3 dias' },
  { codigo: '7896.0045', produto: 'Óleo de soja 900ml', pdvs: 3, desde: '1 dia' },
  { codigo: '7893.5520', produto: 'Leite UHT integral 1L', pdvs: 2, desde: 'hoje' },
  { codigo: '7892.8804', produto: 'Biscoito cream cracker 400g', pdvs: 2, desde: 'hoje' },
];

const JORNADA_INICIO_HORA = 7;
const JORNADA_FIM_HORA = 17;
const HORA_ATUAL = 10.68; // 10:41

function faixaGantt() {
  const horas: number[] = [];
  for (let h = JORNADA_INICIO_HORA; h <= JORNADA_FIM_HORA; h++) horas.push(h);
  return horas;
}

export function OperacaoDoDiaPage() {
  const cabecalho = usePageHeader(
    <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
      Operação do dia
    </Typography>,
  );

  const totalHoras = JORNADA_FIM_HORA - JORNADA_INICIO_HORA;
  const horasDecorridas = HORA_ATUAL - JORNADA_INICIO_HORA;
  const ritmoDia = Math.round((horasDecorridas / totalHoras) * 100);

  return (
    <Box>
      {cabecalho}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          qua 23/09 · 10:41 · jornada 07:00–17:00
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />}>
            Exportar
          </Button>
          <Button variant="outlined" size="small" startIcon={<ForumIcon />}>
            Mensagem à equipe
          </Button>
          <Button variant="contained" size="small" startIcon={<PlaylistAddIcon />}>
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
            49/90 <Typography component="span" variant="body2" color="text.secondary">54%</Typography>
          </Typography>
          <LinearProgress variant="determinate" value={54} sx={{ mt: 0.5, mb: 0.5, height: 5, borderRadius: 5 }} />
          <Typography variant="caption" color="text.secondary">ritmo do dia {ritmoDia}%</Typography>
        </Paper>
        <Paper sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            EM CAMPO
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>10/12</Typography>
          <Typography variant="caption" color="text.secondary">1 encerrado</Typography>
        </Paper>
        <Paper sx={{ p: 1.5, borderLeft: '3px solid #f59e0b' }}>
          <Typography variant="caption" color="text.secondary">
            ATRASADOS
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#b45309' }}>2</Typography>
          <Typography variant="caption" color="text.secondary">check-in {'>'} 30 min</Typography>
        </Paper>
        <Paper sx={{ p: 1.5, borderLeft: '3px solid #dc2626' }}>
          <Typography variant="caption" color="text.secondary">
            SEM SINAL
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#dc2626' }}>1</Typography>
          <Typography variant="caption" color="text.secondary">{'>'} 30 min sem GPS</Typography>
        </Paper>
        <Paper sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            RUPTURAS ABERTAS
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>13</Typography>
          <Typography variant="caption" color="text.secondary">em 6 PDVs</Typography>
        </Paper>
        <Paper sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            FORMULÁRIOS EMITIDOS
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>34/60</Typography>
          <Typography variant="caption" color="text.secondary">3 com alerta</Typography>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2, mb: 2, alignItems: 'start' }}>
        {/* Equipe em campo */}
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Equipe em campo <Chip label={equipe.length} size="small" sx={{ ml: 1 }} />
            </Typography>
          </Box>
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
                {equipe.map((linha) => (
                  <TableRow key={linha.nome} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: SITUACAO_COR[linha.situacao], flexShrink: 0 }} />
                        <UsuarioAvatar nome={linha.nome} fotoUrl={null} size={24} />
                        <Box>
                          <Typography variant="body2">{linha.nome}</Typography>
                          <Typography variant="caption" color="text.secondary">{SITUACAO_LABEL[linha.situacao]}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{linha.pdvAtual ?? <Typography color="error" variant="body2">Sem check-in</Typography>}</TableCell>
                    <TableCell>{linha.checkin ?? '—'}</TableCell>
                    <TableCell sx={{ minWidth: 90 }}>
                      <Typography variant="caption">{linha.visitasFeitas}/{linha.visitasTotal}</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={(linha.visitasFeitas / linha.visitasTotal) * 100}
                        sx={{ height: 4, borderRadius: 4, mt: 0.3 }}
                      />
                    </TableCell>
                    <TableCell align="right">{linha.rupturas || '—'}</TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{ color: linha.sinalMinutos > 30 ? '#dc2626' : 'text.secondary', fontWeight: linha.sinalMinutos > 30 ? 700 : 400 }}
                      >
                        {linha.sinalMinutos} min
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Fila de ações */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Fila de ações <Chip label={filaAcoes.length} size="small" sx={{ ml: 1 }} />
          </Typography>
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
                  <Typography variant="caption" color="text.secondary">{item.horario}</Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.3 }}>{item.titulo}</Typography>
                <Typography variant="caption" color="text.secondary">{item.subtitulo}</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  {item.acoes.map((acao) => (
                    <Button key={acao} size="small" variant="text" sx={{ minWidth: 0, p: '2px 6px', fontSize: 12 }}>
                      {acao}
                    </Button>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2 }}>
        {/* Jornada (Gantt) */}
        <Paper sx={{ p: 2, overflowX: 'auto' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Jornada
          </Typography>
          <Box sx={{ minWidth: 640 }}>
            <Box sx={{ display: 'flex', pl: '110px', mb: 0.5, position: 'relative' }}>
              {faixaGantt().map((h) => (
                <Box key={h} sx={{ flex: 1, fontSize: 11, color: 'text.secondary' }}>
                  {String(h).padStart(2, '0')}h
                </Box>
              ))}
            </Box>
            {jornada.map((linha) => (
              <Box key={linha.nome} sx={{ display: 'flex', alignItems: 'center', height: 26, position: 'relative' }}>
                <Typography variant="caption" sx={{ width: 110, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pr: 1 }}>
                  {linha.nome}
                </Typography>
                <Box sx={{ position: 'relative', flexGrow: 1, height: 16, bgcolor: 'action.hover', borderRadius: 0.5 }}>
                  {linha.blocos.map((bloco, i) => {
                    const esquerda = ((bloco.inicioHora - JORNADA_INICIO_HORA) / totalHoras) * 100;
                    const largura = ((bloco.fimHora - bloco.inicioHora) / totalHoras) * 100;
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
        </Paper>

        {/* Rupturas por SKU */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <InventoryIcon fontSize="small" /> Rupturas por SKU
          </Typography>
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
                  <TableRow key={linha.codigo} hover>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{linha.codigo}</Typography>
                    </TableCell>
                    <TableCell>{linha.produto}</TableCell>
                    <TableCell align="right">{linha.pdvs}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={linha.desde}
                        size="small"
                        color={linha.desde === 'hoje' ? 'default' : 'warning'}
                        variant={linha.desde === 'hoje' ? 'outlined' : 'filled'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Button size="small" sx={{ mt: 1 }}>
            Ver todas
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}
