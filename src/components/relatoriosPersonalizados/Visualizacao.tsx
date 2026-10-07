import { Alert, Box, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TablePagination, TableRow, Typography } from '@mui/material';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ColunaResultado, FormatoMetrica, ItemDistribuicao, ResultadoRelatorio, Visual } from '../../lib/api/relatoriosPersonalizados';
import { formatarValor, melhorQuandoMaior } from '../../pages/relatoriosPersonalizados/formatacao';
import { horus } from '../../theme';
import { Variacao } from '../relatorios/Comparativo';

const POR_PAGINA = 50;
const MAX_PONTOS_GRAFICO = 50;
const CORES = ['#4f46e5', '#f59e0b', '#15803d', '#b91c1c', '#0891b2', '#7c3aed', '#db2777', '#65a30d', '#3730a3', '#b45309'];

type Linha = ResultadoRelatorio['linhas'][number];

/**
 * Desenho do resultado do gerador de relatórios (docs/60): KPIs + quebras, e a tabela, a matriz
 * (pivot, quando há campo em "Colunas") ou o gráfico. Usado na tela do relatório e na prévia do
 * editor — os números vêm prontos do backend, inclusive os totais da matriz.
 */
export function Visualizacao({ resultado, visual }: { resultado: ResultadoRelatorio; visual: Visual }) {
  const metricas = resultado.colunas.filter((c) => c.tipo !== 'dimensao');
  const escalares = metricas.filter((m) => m.tipo !== 'distribuicao');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <Kpis resultado={resultado} escalares={escalares} />
      <Distribuicoes resultado={resultado} metricas={metricas.filter((m) => m.tipo === 'distribuicao')} />
      {resultado.linhas_truncadas && <Alert severity="warning">O resultado passou do limite de linhas e foi cortado. Use um período menor ou menos agrupamentos.</Alert>}
      {resultado.definicao_resolvida.agrupar.length > 0 &&
        (visual === 'tabela' ? <Tabela resultado={resultado} escalares={escalares} /> : <Grafico resultado={resultado} escalares={escalares} visual={visual} />)}
    </Box>
  );
}

function Kpis({ resultado, escalares }: { resultado: ResultadoRelatorio; escalares: ColunaResultado[] }) {
  if (escalares.length === 0) return null;
  return (
    <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5, m: 0 }}>
      {escalares.map((m) => {
        const atual = resultado.totais[m.chave];
        const anterior = resultado.comparativo?.totais[m.chave];
        return (
          <Box key={m.chave} sx={{ border: `1px solid ${horus.borda}`, borderRadius: '6px', px: 1.75, py: 1.25, bgcolor: horus.subcard }}>
            <Typography component="dt" sx={{ fontSize: 12, color: 'text.secondary' }}>
              {m.rotulo}
            </Typography>
            <Typography component="dd" sx={{ m: 0, fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {formatarValor(atual, m.tipo as FormatoMetrica)}
            </Typography>
            {typeof atual === 'number' && typeof anterior === 'number' && (
              <Variacao atual={atual} anterior={anterior} melhorQuandoMaior={melhorQuandoMaior(m.chave)} sufixo={m.tipo === 'percentual' ? ' pp' : ''} />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function Distribuicoes({ resultado, metricas }: { resultado: ResultadoRelatorio; metricas: ColunaResultado[] }) {
  if (metricas.length === 0) return null;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
      {metricas.map((m) => {
        const itens = (resultado.totais[m.chave] as ItemDistribuicao[] | undefined) ?? [];
        return (
          <Box key={m.chave} sx={{ border: `1px solid ${horus.borda}`, borderRadius: '6px', p: 1.75 }}>
            <Typography component="h3" sx={{ fontSize: 13.5, fontWeight: 600, mb: 1 }}>
              {m.rotulo}
            </Typography>
            {itens.length === 0 ? (
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Nenhuma no período.</Typography>
            ) : (
              itens.map((item) => (
                <Box key={item.chave} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.5, borderTop: `1px solid ${horus.borda}`, '&:first-of-type': { borderTop: 0 } }}>
                  <Typography noWrap sx={{ fontSize: 13 }}>
                    {item.rotulo}
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{item.quantidade}</Typography>
                </Box>
              ))
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/** Campos de agrupamento por eixo, na ordem da definição. */
function eixos(resultado: ResultadoRelatorio) {
  const rotulos = Object.fromEntries(resultado.colunas.map((c) => [c.chave, c.rotulo]));
  const agrupar = resultado.definicao_resolvida.agrupar;
  const comRotulo = (eixo: 'linha' | 'coluna') =>
    agrupar
      .filter((g) => (g.eixo ?? 'linha') === eixo)
      .map((g) => {
        const chave = g.chave ?? g.campo;
        return { chave, rotulo: rotulos[chave] ?? g.campo };
      });
  return { linhas: comRotulo('linha'), colunas: comRotulo('coluna') };
}

const chaveDe = (l: Linha, campos: { chave: string }[]) => campos.map((c) => l.dimensoes[c.chave]?.chave ?? '-').join('|');
const rotuloDe = (l: Linha, campos: { chave: string }[]) => campos.map((c) => l.dimensoes[c.chave]?.rotulo ?? '—').join(' · ');

function Tabela({ resultado, escalares }: { resultado: ResultadoRelatorio; escalares: ColunaResultado[] }) {
  const [pagina, setPagina] = useState(0);
  const { linhas: dimLinha, colunas: dimColuna } = eixos(resultado);
  const matriz = dimColuna.length > 0 && resultado.subtotais;
  const corpo = matriz ? resultado.subtotais!.linhas : resultado.linhas;
  const celula = (valor: Linha['valores'][string] | undefined, m: ColunaResultado) => formatarValor(valor, m.tipo as FormatoMetrica);
  const numero = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const;

  // Matriz: valor de (linha, coluna) a partir das linhas agrupadas por todos os campos.
  const colunasMatriz = matriz ? resultado.subtotais!.colunas : [];
  const indice = new Map<string, Linha>();
  if (matriz) for (const l of resultado.linhas) indice.set(`${chaveDe(l, dimLinha)}||${chaveDe(l, dimColuna)}`, l);
  const variasMetricas = escalares.length > 1;

  return (
    <Box sx={{ border: `1px solid ${horus.borda}`, borderRadius: '6px', overflow: 'hidden' }}>
      <TableContainer>
        <Table>
          <TableHead>
            {matriz ? (
              <>
                <TableRow>
                  {dimLinha.map((d) => (
                    <TableCell key={d.chave} rowSpan={variasMetricas ? 2 : 1}>
                      {d.rotulo}
                    </TableCell>
                  ))}
                  {colunasMatriz.map((c) => (
                    <TableCell key={chaveDe(c, dimColuna)} align={variasMetricas ? 'center' : 'right'} colSpan={escalares.length}>
                      {rotuloDe(c, dimColuna)}
                    </TableCell>
                  ))}
                  <TableCell align={variasMetricas ? 'center' : 'right'} colSpan={escalares.length} sx={{ fontWeight: 600 }}>
                    Total
                  </TableCell>
                </TableRow>
                {variasMetricas && (
                  <TableRow>
                    {[...colunasMatriz, null].flatMap((_c, ci) =>
                      escalares.map((m) => (
                        <TableCell key={`${ci}-${m.chave}`} align="right">
                          {m.rotulo}
                        </TableCell>
                      )),
                    )}
                  </TableRow>
                )}
              </>
            ) : (
              <TableRow>
                {dimLinha.map((d) => (
                  <TableCell key={d.chave}>{d.rotulo}</TableCell>
                ))}
                {escalares.map((m) => (
                  <TableCell key={m.chave} align="right">
                    {m.rotulo}
                  </TableCell>
                ))}
              </TableRow>
            )}
          </TableHead>
          <TableBody>
            {corpo.length === 0 && (
              <TableRow>
                <TableCell colSpan={99} sx={{ color: 'text.secondary' }}>
                  Nada nesse período.
                </TableCell>
              </TableRow>
            )}
            {corpo.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map((l) => (
              <TableRow key={chaveDe(l, dimLinha)} hover>
                {dimLinha.map((d) => (
                  <TableCell key={d.chave}>{l.dimensoes[d.chave]?.rotulo}</TableCell>
                ))}
                {matriz &&
                  colunasMatriz.flatMap((c) =>
                    escalares.map((m) => (
                      <TableCell key={`${chaveDe(c, dimColuna)}-${m.chave}`} align="right" sx={numero}>
                        {celula(indice.get(`${chaveDe(l, dimLinha)}||${chaveDe(c, dimColuna)}`)?.valores[m.chave], m)}
                      </TableCell>
                    )),
                  )}
                {escalares.map((m) => (
                  <TableCell key={m.chave} align="right" sx={{ ...numero, fontWeight: matriz ? 600 : 400 }}>
                    {celula(l.valores[m.chave], m)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {corpo.length > 0 && (
            <TableFooter>
              <TableRow sx={{ '& td': { fontWeight: 600, color: 'text.primary', fontSize: 13, borderTop: `1px solid ${horus.borda}`, bgcolor: horus.subcard } }}>
                <TableCell colSpan={Math.max(1, dimLinha.length)}>Total</TableCell>
                {matriz &&
                  colunasMatriz.flatMap((c) =>
                    escalares.map((m) => (
                      <TableCell key={`${chaveDe(c, dimColuna)}-${m.chave}`} align="right" sx={numero}>
                        {celula(c.valores[m.chave], m)}
                      </TableCell>
                    )),
                  )}
                {escalares.map((m) => (
                  <TableCell key={m.chave} align="right" sx={numero}>
                    {celula(resultado.totais[m.chave], m)}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </TableContainer>
      {corpo.length > POR_PAGINA && (
        <TablePagination
          component="div"
          count={corpo.length}
          page={pagina}
          onPageChange={(_, p) => setPagina(p)}
          rowsPerPage={POR_PAGINA}
          rowsPerPageOptions={[POR_PAGINA]}
        />
      )}
    </Box>
  );
}

function Grafico({ resultado, escalares, visual }: { resultado: ResultadoRelatorio; escalares: ColunaResultado[]; visual: Exclude<Visual, 'tabela'> }) {
  const { linhas: dimLinha, colunas: dimColuna } = eixos(resultado);
  // Moda é texto — não vira barra nem fatia.
  const numericas = escalares.filter((m) => m.tipo !== 'texto');
  const principal = numericas[0];
  if (!principal) return <Alert severity="info">Adicione uma métrica numérica em Valores para desenhar o gráfico.</Alert>;

  const matriz = dimColuna.length > 0 && resultado.subtotais;
  const baseLinhas = matriz ? resultado.subtotais!.linhas : resultado.linhas;
  // Eixo de data: do mais antigo pro mais recente, que é como se lê um gráfico no tempo.
  const ehData = resultado.definicao_resolvida.agrupar[0]?.granularidade !== undefined;
  const ordenadas = ehData ? [...baseLinhas].sort((a, b) => chaveDe(a, dimLinha).localeCompare(chaveDe(b, dimLinha))) : baseLinhas;
  const pontos = ordenadas.slice(0, MAX_PONTOS_GRAFICO);

  // Matriz: uma série por coluna (da primeira métrica); senão, uma série por métrica.
  const series = matriz
    ? resultado.subtotais!.colunas.map((c) => ({ chave: chaveDe(c, dimColuna), rotulo: rotuloDe(c, dimColuna) }))
    : numericas.map((m) => ({ chave: m.chave, rotulo: m.rotulo }));
  const indice = new Map<string, Linha>();
  if (matriz) for (const l of resultado.linhas) indice.set(`${chaveDe(l, dimLinha)}||${chaveDe(l, dimColuna)}`, l);

  const dados = pontos.map((l) => {
    const ponto: Record<string, string | number | null> = { nome: rotuloDe(l, dimLinha) };
    for (const s of series) {
      const v = matriz ? indice.get(`${chaveDe(l, dimLinha)}||${s.chave}`)?.valores[principal.chave] : l.valores[s.chave];
      ponto[s.chave] = typeof v === 'number' ? v : null;
    }
    return ponto;
  });
  const formatar = (v: unknown, chave?: string) => {
    const formato = (matriz ? principal.tipo : (numericas.find((m) => m.chave === chave)?.tipo ?? principal.tipo)) as FormatoMetrica;
    return typeof v === 'number' ? formatarValor(v, formato) : '—';
  };

  return (
    <Box sx={{ border: `1px solid ${horus.borda}`, borderRadius: '6px', p: 2 }}>
      {baseLinhas.length > MAX_PONTOS_GRAFICO && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
          Mostrando {MAX_PONTOS_GRAFICO} de {baseLinhas.length}. Use a tabela para ver tudo.
        </Typography>
      )}
      <Box sx={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          {visual === 'pizza' ? (
            <PieChart>
              <Pie data={dados} dataKey={matriz ? series[0]?.chave : principal.chave} nameKey="nome" outerRadius={130} label={(e) => String(e.name)}>
                {dados.map((_, i) => (
                  <Cell key={i} fill={CORES[i % CORES.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatar(v)} />
            </PieChart>
          ) : visual === 'linha' ? (
            <LineChart data={dados} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={horus.borda} vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v, _n, item) => formatar(v, String(item.dataKey))} />
              <Legend />
              {series.map((s, i) => (
                <Line key={s.chave} type="monotone" dataKey={s.chave} name={s.rotulo} stroke={CORES[i % CORES.length]} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          ) : (
            <BarChart data={dados} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={horus.borda} vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v, _n, item) => formatar(v, String(item.dataKey))} />
              <Legend />
              {series.map((s, i) => (
                <Bar key={s.chave} dataKey={s.chave} name={s.rotulo} fill={CORES[i % CORES.length]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
