import { Box, ToggleButton, ToggleButtonGroup, Typography, useTheme } from '@mui/material';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LinhaPlanejadoExecutado, LinhaTempoNaLoja } from '../../lib/api/relatorios';

export type Visao = 'tabela' | 'grafico';
export type MedidaTempo = 'media' | 'soma';

// Média (o ritmo de cada visita) ou soma (onde o tempo da equipe foi gasto) — docs/61 §6.2.
export function AlternarMedida({ valor, onChange }: { valor: MedidaTempo; onChange: (v: MedidaTempo) => void }) {
  return (
    <ToggleButtonGroup size="small" exclusive value={valor} onChange={(_, v: MedidaTempo | null) => v && onChange(v)} aria-label="Medida do tempo">
      <ToggleButton value="media" sx={{ textTransform: 'none' }}>
        Média
      </ToggleButton>
      <ToggleButton value="soma" sx={{ textTransform: 'none' }}>
        Soma
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

// Alterna a mesma consulta entre tabela e gráfico (docs/60 — o gerador terá o mesmo seletor).
export function AlternarVisao({ valor, onChange }: { valor: Visao; onChange: (v: Visao) => void }) {
  return (
    <ToggleButtonGroup size="small" exclusive value={valor} onChange={(_, v: Visao | null) => v && onChange(v)} aria-label="Forma de exibição">
      <ToggleButton value="tabela" sx={{ textTransform: 'none' }}>
        Tabela
      </ToggleButton>
      <ToggleButton value="grafico" sx={{ textTransform: 'none' }}>
        Gráfico
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

function dia(iso: string): string {
  const [, mes, d] = iso.split('-');
  return `${d}/${mes}`;
}

function Vazio() {
  return (
    <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
      Não temos dados para montar o gráfico nesse período.
    </Typography>
  );
}

/** Visitas por dia, empilhadas por situação (soma de todos os promotores filtrados). */
export function GraficoCumprimento({ linhas }: { linhas: LinhaPlanejadoExecutado[] }) {
  const theme = useTheme();
  const porDia = new Map<string, { dia: string; Cumpridas: number; 'Em andamento': number; Atrasadas: number; 'A vencer': number; Canceladas: number }>();
  for (const l of linhas) {
    const atual = porDia.get(l.data) ?? { dia: dia(l.data), Cumpridas: 0, 'Em andamento': 0, Atrasadas: 0, 'A vencer': 0, Canceladas: 0 };
    atual.Cumpridas += l.cumpridas;
    atual['Em andamento'] += l.em_andamento;
    atual.Atrasadas += l.atrasadas;
    atual['A vencer'] += l.a_vencer;
    atual.Canceladas += l.canceladas;
    porDia.set(l.data, atual);
  }
  const dados = [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  if (dados.length === 0) return <Vazio />;

  return (
    <Box sx={{ height: 360 }} role="img" aria-label="Gráfico de visitas por dia, por situação">
      <ResponsiveContainer>
        <BarChart data={dados}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="dia" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Cumpridas" stackId="v" fill={theme.palette.success.main} />
          <Bar dataKey="Em andamento" stackId="v" fill={theme.palette.info.main} />
          <Bar dataKey="A vencer" stackId="v" fill={theme.palette.grey[400]} />
          <Bar dataKey="Atrasadas" stackId="v" fill={theme.palette.error.main} />
          <Bar dataKey="Canceladas" stackId="v" fill={theme.palette.warning.main} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

/** Tempo médio por loja/promotor/rede/dia (top 15 por tempo total), com o período de comparação ao lado. */
export function GraficoTempo({ linhas, comparando, medida = 'media', porDia = false }: { linhas: LinhaTempoNaLoja[]; comparando: boolean; medida?: MedidaTempo; porDia?: boolean }) {
  const theme = useTheme();
  const soma = medida === 'soma';
  const rotulo = soma ? 'Tempo total (min)' : 'Média (min)';
  const dados = linhas.slice(0, 15).map((l) => {
    const nome = porDia ? dia(l.nome) : l.nome;
    return {
      nome: nome.length > 22 ? `${nome.slice(0, 21)}…` : nome,
      [rotulo]: (soma ? l.tempo_total_minutos : l.media_minutos) ?? 0,
      'Média no comparativo (min)': l.media_minutos_comparativo ?? 0,
    };
  });
  if (dados.length === 0) return <Vazio />;

  return (
    <Box sx={{ height: Math.max(280, dados.length * (comparando ? 44 : 30) + 60) }} role="img" aria-label={soma ? 'Gráfico de tempo total por grupo' : 'Gráfico de tempo médio por grupo'}>
      <ResponsiveContainer>
        <BarChart key={medida} data={dados} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" unit=" min" />
          <YAxis type="category" dataKey="nome" width={150} />
          <Tooltip />
          <Legend />
          <Bar dataKey={rotulo} name={rotulo} fill={theme.palette.primary.main} />
          {comparando && !soma && <Bar dataKey="Média no comparativo (min)" fill={theme.palette.grey[400]} />}
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
