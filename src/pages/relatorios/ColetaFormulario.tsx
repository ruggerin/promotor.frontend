import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useMemo, useState } from 'react';
import { baixarPdfColetaFormulario, buscarColetaFormulario } from '../../lib/api/relatorios';
import { ehNumerico, montarMatriz, type Agrupamento, type EixoLinhas } from '../../lib/coletaFormulario';
import { baixarBlob, baixarCsv } from '../../lib/csv';

type FiltroPerguntas = 'numericas' | 'todas' | string;

interface Props {
  filtros: {
    tipo_registro_uuid: string;
    data_inicio: string;
    data_fim: string;
    usuario_uuid: string | null;
    rede_loja_uuid: string | null;
    ponto_venda_uuid: string | null;
  };
}

const formatarDataISO = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Aba "Analítico" da tela "Coleta por Formulário" (docs/39-RELATORIO-ANALITICO-PIVOT.md) — matriz Loja × Produto (ou o
 * inverso), uma linha por coleta, rodapé de estatística só pra pergunta numérica. O pivot é
 * montado aqui a partir da lista plana do backend (lib/coletaFormulario.ts).
 */
export function ColetaFormulario({ filtros }: Props) {
  const [linhas, setLinhas] = useState<EixoLinhas>('loja');
  const [agrupar, setAgrupar] = useState<Agrupamento>('eixo');
  const [filtroPerguntas, setFiltroPerguntas] = useState<FiltroPerguntas>('numericas');

  const query = useQuery({
    queryKey: ['relatorio-coleta', filtros],
    queryFn: () => buscarColetaFormulario(filtros),
  });
  const dados = query.data;

  const campos = useMemo(() => dados?.campos ?? [], [dados]);
  const temNumericas = campos.some(ehNumerico);
  // "Só numéricas" é o default (pesquisa de preço); sem pergunta numérica, cai pra todas.
  const filtroEfetivo = filtroPerguntas === 'numericas' && !temNumericas ? 'todas' : filtroPerguntas;
  const chaves = useMemo(
    () =>
      campos
        .filter((c) =>
          filtroEfetivo === 'numericas' ? ehNumerico(c) : filtroEfetivo === 'todas' ? true : c.chave === filtroEfetivo,
        )
        .map((c) => c.chave),
    [campos, filtroEfetivo],
  );

  const matriz = useMemo(
    () => (dados ? montarMatriz(dados, { linhas, agrupar, campos: chaves }) : null),
    [dados, linhas, agrupar, chaves],
  );

  const titulo = dados ? `Coleta por Formulário (analítico) — ${dados.tipo_registro.descricao}` : '';
  const subtitulo = dados
    ? `${formatarDataISO(dados.periodo.data_inicio)} a ${formatarDataISO(dados.periodo.data_fim)} · ${matriz?.linhas.length ?? 0} linha(s)`
    : '';

  const pdfMutation = useMutation({
    mutationFn: () =>
      baixarPdfColetaFormulario({
        titulo,
        subtitulo,
        cabecalho: matriz!.cabecalho,
        linhas: matriz!.linhas.map((l) => l.map((c) => c.texto)),
        rodape: matriz!.rodape.map((l) => l.map((c) => c.texto)),
      }),
    onSuccess: (blob) => baixarBlob(`coleta-${filtros.data_inicio}-a-${filtros.data_fim}.pdf`, blob),
  });

  // CSV com ";" + BOM — abre direto no Excel pt-BR (mesmo padrão dos outros relatórios).
  function exportarExcel() {
    if (!matriz || !dados) return;
    baixarCsv(
      `coleta-${dados.tipo_registro.descricao.replace(/\s+/g, '-').toLowerCase()}-${filtros.data_inicio}-a-${filtros.data_fim}.csv`,
      matriz.rotulosColunas,
      [...matriz.linhas, ...matriz.rodape].map((l) => l.map((c) => c.texto)),
    );
  }

  const erro = axios.isAxiosError<{ message?: string }>(query.error)
    ? (query.error.response?.data.message ?? 'Não foi possível carregar a coleta.')
    : null;

  if (query.isLoading) return <CircularProgress size={24} />;
  if (erro) return <Alert severity="error">{erro}</Alert>;
  if (!dados || !matriz) return null;

  const multiPergunta = chaves.length > 1;
  const vazio = matriz.linhas.length === 0;

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Linhas
          </Typography>
          <ToggleButtonGroup size="small" exclusive value={linhas} onChange={(_, v: EixoLinhas | null) => v && setLinhas(v)}>
            <ToggleButton value="loja">Loja</ToggleButton>
            <ToggleButton value="produto">Produto</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {multiPergunta && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Agrupar colunas
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={agrupar}
              onChange={(_, v: Agrupamento | null) => v && setAgrupar(v)}
            >
              <ToggleButton value="eixo">{linhas === 'loja' ? 'Produto → Pergunta' : 'Coleta → Pergunta'}</ToggleButton>
              <ToggleButton value="pergunta">{linhas === 'loja' ? 'Pergunta → Produto' : 'Pergunta → Coleta'}</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}
        <TextField
          select
          size="small"
          label="Perguntas"
          value={filtroEfetivo}
          onChange={(e) => setFiltroPerguntas(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          {temNumericas && <MenuItem value="numericas">Só numéricas (preço, quantidade…)</MenuItem>}
          <MenuItem value="todas">Todas as perguntas</MenuItem>
          {campos.map((c) => (
            <MenuItem key={c.chave} value={c.chave}>
              {c.rotulo}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Button size="small" startIcon={<DownloadIcon />} onClick={exportarExcel} disabled={vazio}>
            Exportar Excel
          </Button>
          <Button
            size="small"
            startIcon={<PictureAsPdfIcon />}
            disabled={vazio || pdfMutation.isPending}
            onClick={() => pdfMutation.mutate()}
          >
            {pdfMutation.isPending ? 'Gerando PDF...' : 'Exportar PDF'}
          </Button>
        </Box>
      </Paper>

      {pdfMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Não foi possível gerar o PDF — a matriz pode estar grande demais. Tente filtrar o período, a loja ou as
          perguntas.
        </Alert>
      )}

      {vazio ? (
        <Alert severity="info">Nenhuma coleta respondida no período para as perguntas escolhidas.</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              {matriz.cabecalho.map((linha, i) => (
                <TableRow key={i}>
                  {linha.map((c, j) => (
                    <TableCell
                      key={j}
                      colSpan={c.colunas}
                      rowSpan={c.linhas}
                      align={j < matriz.colunasFixas && i === 0 ? 'left' : 'center'}
                      sx={{
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        // Segunda linha do cabeçalho gruda logo abaixo da primeira.
                        top: i === 1 ? 37 : undefined,
                        borderLeft: c.colunas ? 1 : undefined,
                        borderColor: 'divider',
                      }}
                    >
                      {c.texto}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {matriz.linhas.map((linha, i) => (
                <TableRow key={i} hover>
                  {linha.map((c, j) => (
                    <TableCell
                      key={j}
                      align={c.numero ? 'right' : 'left'}
                      sx={{
                        whiteSpace: 'nowrap',
                        color: c.texto === '—' ? 'text.disabled' : undefined,
                        fontWeight: j === 0 ? 600 : undefined,
                      }}
                    >
                      {c.texto}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            {matriz.rodape.length > 0 && (
              <TableFooter>
                {matriz.rodape.map((linha, i) => (
                  <TableRow key={i} sx={{ bgcolor: 'action.hover' }}>
                    {linha.map((c, j) => (
                      <TableCell
                        key={j}
                        align={c.numero ? 'right' : 'left'}
                        sx={{ fontWeight: 700, color: 'text.primary', fontSize: 13, whiteSpace: 'nowrap' }}
                      >
                        {c.texto}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableFooter>
            )}
          </Table>
        </TableContainer>
      )}
      {!temNumericas && !vazio && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Sem pergunta numérica neste formulário — a matriz mostra as respostas, sem rodapé de estatística.
        </Typography>
      )}
    </Box>
  );
}
