import { Box, ToggleButton, ToggleButtonGroup, Typography, useTheme } from '@mui/material';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
// `extras`: visões a mais de um relatório (ex.: "Por loja" no cumprimento de visitas).
export function AlternarVisao<V extends string = Visao>({ valor, onChange, extras = [] }: { valor: V; onChange: (v: V) => void; extras?: { valor: V; rotulo: string }[] }) {
  return (
    <ToggleButtonGroup size="small" exclusive value={valor} onChange={(_, v: V | null) => v && onChange(v)} aria-label="Forma de exibição">
      <ToggleButton value="tabela" sx={{ textTransform: 'none' }}>
        Tabela
      </ToggleButton>
      <ToggleButton value="grafico" sx={{ textTransform: 'none' }}>
        Gráfico
      </ToggleButton>
      {extras.map((e) => (
        <ToggleButton key={e.valor} value={e.valor} sx={{ textTransform: 'none' }}>
          {e.rotulo}
        </ToggleButton>
      ))}
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

/**
 * Como terminou o planejado do período, em pizza (rosca): cumpridas, não visitadas, em andamento,
 * a vencer e canceladas, com o cumprimento no centro. Espontâneas ficam fora (não eram planejadas),
 * como no percentual.
 */
export function GraficoCumprimento({ linhas }: { linhas: LinhaPlanejadoExecutado[] }) {
  const theme = useTheme();
  const soma = (campo: 'cumpridas' | 'em_andamento' | 'atrasadas' | 'a_vencer' | 'canceladas' | 'planejadas') =>
    linhas.reduce((t, l) => t + l[campo], 0);
  const fatias = [
    { nome: 'Cumpridas', valor: soma('cumpridas'), cor: theme.palette.success.main },
    { nome: 'Não visitadas', valor: soma('atrasadas'), cor: theme.palette.error.main },
    { nome: 'Em andamento', valor: soma('em_andamento'), cor: theme.palette.info.main },
    { nome: 'A vencer', valor: soma('a_vencer'), cor: theme.palette.grey[500] },
    { nome: 'Canceladas', valor: soma('canceladas'), cor: theme.palette.warning.main },
  ].filter((f) => f.valor > 0);
  const total = fatias.reduce((t, f) => t + f.valor, 0);
  if (total === 0) return <Vazio />;
  const planejadas = soma('planejadas');
  const cumprimento = planejadas > 0 ? Math.round((soma('cumpridas') / planejadas) * 100) : null;

  return (
    <Box
      sx={{ height: 360, position: 'relative' }}
      role="img"
      aria-label={`Gráfico de pizza das visitas planejadas por situação: ${fatias.map((f) => `${f.nome} ${f.valor}`).join(', ')}`}
    >
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={fatias}
            dataKey="valor"
            nameKey="nome"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={fatias.length > 1 ? 2 : 0}
            stroke={theme.palette.background.paper}
            label={(e: { value?: number }) => `${Math.round(((e.value ?? 0) / total) * 100)}%`}
            isAnimationActive={false}
          >
            {fatias.map((f) => (
              <Cell key={f.nome} fill={f.cor} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => [`${v} (${Math.round((Number(v) / total) * 100)}%)`]}
            contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 6 }}
            itemStyle={{ color: theme.palette.text.primary }}
          />
          <Legend formatter={(nome, item) => `${nome}: ${(item.payload as { valor?: number } | undefined)?.valor ?? ''}`} />
        </PieChart>
      </ResponsiveContainer>
      {cumprimento !== null && (
        <Box sx={{ position: 'absolute', inset: 0, bottom: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {cumprimento}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            cumprimento
          </Typography>
        </Box>
      )}
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
