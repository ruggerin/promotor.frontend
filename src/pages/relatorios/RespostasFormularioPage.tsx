import DownloadIcon from '@mui/icons-material/Download';
import { Alert, Autocomplete, Box, Button, CircularProgress, LinearProgress, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { FiltroPeriodo, hojeISO } from '../../components/relatorios/FiltroPeriodo';
import { SeletorPontoVenda } from '../../components/relatorios/SeletorPontoVenda';
import {
  baixarPdfRespostasFormulario,
  buscarRespostasFormulario,
  type CampoAgregado,
  type RelatorioRespostasFormulario,
} from '../../lib/api/relatorios';
import { baixarBlob, baixarCsv } from '../../lib/csv';
import { listarRedesLojas } from '../../lib/api/redesLojas';
import { listarTiposRegistro } from '../../lib/api/tiposRegistro';
import { listarUsuarios } from '../../lib/api/usuarios';

const formatar = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function Barras({ itens }: { itens: { rotulo: string; quantidade: number }[] }) {
  const total = itens.reduce((soma, i) => soma + i.quantidade, 0);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {itens.map((item) => (
        <Box key={item.rotulo}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">{item.rotulo}</Typography>
            <Typography variant="body2" color="text.secondary">
              {item.quantidade} ({total > 0 ? Math.round((item.quantidade / total) * 100) : 0}%)
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={total > 0 ? (item.quantidade / total) * 100 : 0} sx={{ height: 8, borderRadius: 4 }} />
        </Box>
      ))}
    </Box>
  );
}

function CartaoCampo({ campo }: { campo: CampoAgregado }) {
  let corpo: React.ReactNode;

  if (campo.respostas === 0) {
    corpo = (
      <Typography variant="body2" color="text.secondary">
        Sem respostas no período.
      </Typography>
    );
  } else if (campo.contagem) {
    corpo = <Barras itens={campo.contagem.map((c) => ({ rotulo: c.valor, quantidade: c.quantidade }))} />;
  } else if (campo.estatisticas) {
    const e = campo.estatisticas;
    corpo = (
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {(
          [
            ['Soma', e.soma],
            ['Média', e.media],
            ['Mínimo', e.minimo],
            ['Máximo', e.maximo],
          ] as const
        ).map(([rotulo, valor]) => (
          <Box key={rotulo}>
            <Typography variant="caption" color="text.secondary">
              {rotulo}
            </Typography>
            <Typography variant="h6">{formatar(valor)}</Typography>
          </Box>
        ))}
      </Box>
    );
  } else if (campo.ausencias) {
    corpo =
      campo.ausencias.produtos.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nenhum produto marcado ausente em {campo.ausencias.checklists} checklist(s).
        </Typography>
      ) : (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Produtos mais marcados como ausentes ({campo.ausencias.checklists} checklist(s) respondido(s))
          </Typography>
          <Barras itens={campo.ausencias.produtos.map((p) => ({ rotulo: p.produto, quantidade: p.vezes_ausente }))} />
        </>
      );
  } else {
    corpo = (
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {campo.ultimas?.map((valor, i) => (
          <li key={i}>
            <Typography variant="body2">{valor}</Typography>
          </li>
        ))}
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 2.5, flex: '1 1 380px' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {campo.rotulo}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        {campo.respostas} resposta(s)
        {campo.tipo_campo === 'TEXTO' || campo.tipo_campo === 'DATA' ? ' — últimas respostas' : ''}
      </Typography>
      {corpo}
    </Paper>
  );
}

// Uma linha por resposta agregada: pergunta, tipo de dado, resposta/estatística e o número —
// formato "longo", que vira tabela dinâmica direto no Excel.
function exportar(dados: RelatorioRespostasFormulario) {
  const linhas: (string | number | null)[][] = [];
  for (const campo of dados.campos) {
    for (const c of campo.contagem ?? []) linhas.push([campo.rotulo, 'Contagem', c.valor, c.quantidade]);
    if (campo.estatisticas) {
      const e = campo.estatisticas;
      linhas.push([campo.rotulo, 'Soma', '', e.soma], [campo.rotulo, 'Média', '', e.media], [campo.rotulo, 'Mínimo', '', e.minimo], [campo.rotulo, 'Máximo', '', e.maximo]);
    }
    for (const p of campo.ausencias?.produtos ?? []) linhas.push([campo.rotulo, 'Ausente no Mix', p.produto, p.vezes_ausente]);
    for (const t of campo.ultimas ?? []) linhas.push([campo.rotulo, 'Resposta', t, null]);
  }
  for (const p of dados.rupturas?.por_produto ?? []) linhas.push(['Rupturas', 'Ruptura', p.produto, p.quantidade]);

  baixarCsv(
    `respostas-${dados.tipo_registro.descricao.replace(/\s+/g, '-').toLowerCase()}-${dados.periodo.data_inicio}-a-${dados.periodo.data_fim}.csv`,
    ['Pergunta', 'Tipo', 'Resposta', 'Quantidade / valor'],
    linhas,
  );
}

/**
 * Relatório "Respostas por pergunta" (docs/28 §2.2): escolhe um formulário e vê cada pergunta
 * agregada — contagem (Sim/Não, múltipla escolha), estatística (número/moeda), ausências do Mix,
 * listagem (texto/data) e, nos formulários de ruptura, o total e o ranking por produto.
 */
export function RespostasFormularioPage() {
  const [inicio, setInicio] = useState(hojeISO(-29));
  const [fim, setFim] = useState(hojeISO());
  const [tipoUuid, setTipoUuid] = useState<string | null>(null);
  const [promotorUuid, setPromotorUuid] = useState<string | null>(null);
  const [redeUuid, setRedeUuid] = useState<string | null>(null);
  const [pontoVendaUuid, setPontoVendaUuid] = useState<string | null>(null);

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Respostas por pergunta
    </Typography>,
  );

  const tiposQuery = useQuery({ queryKey: ['tipos-registro', { ativo: true }], queryFn: () => listarTiposRegistro({ ativo: true }) });
  const promotoresQuery = useQuery({
    queryKey: ['usuarios', 'promotores-relatorio'],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR', por_pagina: 200 }),
  });
  const redesQuery = useQuery({ queryKey: ['redes-lojas'], queryFn: () => listarRedesLojas() });

  const filtros = {
    tipo_registro_uuid: tipoUuid!,
    data_inicio: inicio,
    data_fim: fim,
    usuario_uuid: promotorUuid,
    rede_loja_uuid: redeUuid,
    ponto_venda_uuid: pontoVendaUuid,
  };

  const query = useQuery({
    queryKey: ['relatorio-respostas', { tipoUuid, inicio, fim, promotorUuid, redeUuid, pontoVendaUuid }],
    queryFn: () => buscarRespostasFormulario(filtros),
    enabled: Boolean(tipoUuid && inicio && fim),
  });

  const pdfMutation = useMutation({
    mutationFn: () => baixarPdfRespostasFormulario(filtros),
    onSuccess: (blob) => baixarBlob(`respostas-${inicio}-a-${fim}.pdf`, blob),
  });

  const erro =
    axios.isAxiosError<{ message?: string }>(query.error) ? (query.error.response?.data.message ?? 'Não foi possível carregar o relatório.') : null;
  const dados = query.data;

  return (
    <Box>
      {cabecalho}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Escolha um formulário para ver como ele foi respondido no período, pergunta por pergunta. Registros
        cancelados não entram na conta.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
        <Autocomplete
          size="small"
          sx={{ width: 280 }}
          options={tiposQuery.data?.tipos_registro ?? []}
          getOptionLabel={(t) => t.descricao}
          loading={tiposQuery.isLoading}
          onChange={(_, t) => setTipoUuid(t?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Formulário" />}
        />
        <FiltroPeriodo inicio={inicio} fim={fim} onChange={(i, f) => { setInicio(i); setFim(f); }} />
        <Autocomplete
          size="small"
          sx={{ width: 220 }}
          options={promotoresQuery.data?.usuarios ?? []}
          getOptionLabel={(u) => u.nome}
          onChange={(_, u) => setPromotorUuid(u?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Promotor" />}
        />
        <Autocomplete
          size="small"
          sx={{ width: 220 }}
          options={redesQuery.data?.redes_lojas ?? []}
          getOptionLabel={(r) => r.descricao}
          onChange={(_, r) => setRedeUuid(r?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Rede de lojas" />}
        />
        <SeletorPontoVenda onChange={setPontoVendaUuid} />
      </Box>

      {!tipoUuid && (
        <Alert severity="info">Selecione um formulário para gerar o relatório.</Alert>
      )}
      {erro && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erro}
        </Alert>
      )}
      {query.isLoading && tipoUuid && <CircularProgress size={24} />}

      {dados && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="subtitle2">
              {dados.tipo_registro.descricao} — {dados.total_registros} registro(s) no período
            </Typography>
            <Button size="small" startIcon={<PictureAsPdfIcon />} disabled={pdfMutation.isPending} onClick={() => pdfMutation.mutate()}>
              {pdfMutation.isPending ? 'Gerando PDF...' : 'Exportar PDF'}
            </Button>
            <Button size="small" startIcon={<DownloadIcon />} onClick={() => exportar(dados)}>
              Exportar CSV
            </Button>
          </Box>

          {dados.rupturas && (
            <Paper sx={{ p: 2.5, mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Rupturas
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {dados.rupturas.total} ruptura(s) marcada(s)
              </Typography>
              {dados.rupturas.por_produto.length > 0 && (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Produto</TableCell>
                      <TableCell align="right">Ocorrências</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dados.rupturas.por_produto.map((p) => (
                      <TableRow key={p.produto}>
                        <TableCell>{p.produto}</TableCell>
                        <TableCell align="right">{p.quantidade}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Paper>
          )}

          {dados.campos.length === 0 && !dados.rupturas && (
            <Alert severity="info">Este formulário não tem perguntas para agregar.</Alert>
          )}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {dados.campos.map((campo) => (
              <CartaoCampo key={campo.chave} campo={campo} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
