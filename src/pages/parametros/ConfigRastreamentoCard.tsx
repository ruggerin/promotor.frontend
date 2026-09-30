import MyLocationIcon from '@mui/icons-material/MyLocation';
import {
  Alert,
  Box,
  Button,
  Collapse,
  Divider,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { atualizarParametro, criarParametro } from '../../lib/api/parametros';
import type { Parametro } from '../../types/api';

// Configuração do rastreamento em tempo real num card só (docs/47-RASTREAMENTO-EXIGENCIA.md) — por
// baixo continuam os mesmos parâmetros chave/valor da tabela, mas sem precisar saber o nome da
// chave nem digitar "OBRIGATORIO" certinho (um erro de digitação caía em silêncio no OPCIONAL).

type Exigencia = 'OPCIONAL' | 'AVISO' | 'OBRIGATORIO';

const VERDADEIROS = ['1', 'true', 'sim', 'yes'];
const INTERVALO_MINIMO = 30; // piso do próprio app (mobile/src/lib/rastreamento.ts)

const EXIGENCIAS: { valor: Exigencia; titulo: string; descricao: string }[] = [
  { valor: 'OPCIONAL', titulo: 'Opcional', descricao: 'O promotor pode recusar ou pausar o compartilhamento no Perfil.' },
  {
    valor: 'AVISO',
    titulo: 'Aviso',
    descricao: 'Se a localização estiver desativada, o app mostra um aviso fixo com botão pra resolver. Não trava nada.',
  },
  {
    valor: 'OBRIGATORIO',
    titulo: 'Obrigatório',
    descricao:
      'Sem a localização ativa, o app fica bloqueado até o promotor resolver. Com visita em andamento, ele termina a visita e o bloqueio vem depois.',
  },
];

const DESCRICOES: Record<string, string> = {
  RASTREAMENTO_INTERVALO_SEGUNDOS: 'Intervalo do rastreamento em tempo real, em segundos — 0 = desligado',
  RASTREAMENTO_EXIGENCIA: 'Quanto o app exige do promotor pra manter o rastreamento ligado: OPCIONAL, AVISO ou OBRIGATORIO',
  RASTREAMENTO_SO_NA_JORNADA: 'A exigência de rastreamento só vale dentro de JORNADA_INICIO/JORNADA_FIM — false = o dia inteiro',
  RASTREAMENTO_PAINEL_CONFORMIDADE: 'Mostra no Mapa ao vivo a lista de promotores com rastreamento irregular e o motivo',
  JORNADA_INICIO: 'Início da jornada de trabalho (HH:mm)',
  JORNADA_FIM: 'Fim da jornada de trabalho (HH:mm)',
};

function valorAtivo(parametros: Parametro[], chave: string): string | undefined {
  const p = parametros.find((x) => x.chave === chave);
  return p && p.ativo ? p.valor.trim() : undefined;
}

export function ConfigRastreamentoCard({ parametros }: { parametros: Parametro[] }) {
  const queryClient = useQueryClient();

  const intervaloAtual = Number(valorAtivo(parametros, 'RASTREAMENTO_INTERVALO_SEGUNDOS'));
  const exigenciaAtual = (valorAtivo(parametros, 'RASTREAMENTO_EXIGENCIA') ?? '').toUpperCase();
  const soNaJornadaAtual = valorAtivo(parametros, 'RASTREAMENTO_SO_NA_JORNADA');
  const painelAtual = valorAtivo(parametros, 'RASTREAMENTO_PAINEL_CONFORMIDADE');

  // Mesmos defaults do backend (App\Support\Rastreamento): desligado, OPCIONAL, só na jornada,
  // painel desligado, jornada 07:00–17:00.
  const [ligado, setLigado] = useState(Number.isFinite(intervaloAtual) && intervaloAtual > 0);
  const [intervalo, setIntervalo] = useState(String(Number.isFinite(intervaloAtual) && intervaloAtual > 0 ? intervaloAtual : 60));
  const [exigencia, setExigencia] = useState<Exigencia>(
    exigenciaAtual === 'AVISO' || exigenciaAtual === 'OBRIGATORIO' ? exigenciaAtual : 'OPCIONAL',
  );
  const [soNaJornada, setSoNaJornada] = useState(soNaJornadaAtual === undefined || VERDADEIROS.includes(soNaJornadaAtual.toLowerCase()));
  const [inicio, setInicio] = useState(valorAtivo(parametros, 'JORNADA_INICIO') ?? '07:00');
  const [fim, setFim] = useState(valorAtivo(parametros, 'JORNADA_FIM') ?? '17:00');
  const [painel, setPainel] = useState(painelAtual !== undefined && VERDADEIROS.includes(painelAtual.toLowerCase()));
  const [salvo, setSalvo] = useState(false);

  const intervaloNumero = Number(intervalo);
  const intervaloInvalido = ligado && (!Number.isInteger(intervaloNumero) || intervaloNumero < INTERVALO_MINIMO);
  const jornadaInvalida = soNaJornada && (!inicio || !fim || inicio >= fim);

  const mutation = useMutation({
    mutationFn: async () => {
      const valores: Record<string, string> = {
        RASTREAMENTO_INTERVALO_SEGUNDOS: ligado ? String(intervaloNumero) : '0',
        RASTREAMENTO_EXIGENCIA: exigencia,
        RASTREAMENTO_SO_NA_JORNADA: soNaJornada ? 'true' : 'false',
        RASTREAMENTO_PAINEL_CONFORMIDADE: painel ? 'true' : 'false',
      };
      // A jornada é compartilhada com a Operação do Dia — só grava se o card estiver usando.
      if (soNaJornada) {
        valores.JORNADA_INICIO = inicio;
        valores.JORNADA_FIM = fim;
      }

      for (const [chave, valor] of Object.entries(valores)) {
        const existente = parametros.find((p) => p.chave === chave);
        if (existente) {
          if (existente.valor !== valor || !existente.ativo) await atualizarParametro(existente.id, { valor, ativo: true });
        } else {
          await criarParametro({ chave, valor, descricao: DESCRICOES[chave] });
        }
      }
    },
    onSuccess: () => {
      setSalvo(true);
      void queryClient.invalidateQueries({ queryKey: ['parametros'] });
    },
  });

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.5 }}>
        <MyLocationIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Rastreamento de localização
        </Typography>
        <FormControlLabel
          control={<Switch checked={ligado} onChange={(e) => setLigado(e.target.checked)} />}
          label={ligado ? 'Ligado' : 'Desligado'}
          sx={{ mr: 0 }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: ligado ? 2 : 0 }}>
        Posição dos promotores no Mapa ao vivo durante o expediente. Só funciona no aplicativo instalado (APK), não no Expo Go.
      </Typography>

      <Collapse in={ligado}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            label="Enviar posição a cada (segundos)"
            type="number"
            size="small"
            value={intervalo}
            onChange={(e) => setIntervalo(e.target.value)}
            error={intervaloInvalido}
            helperText={intervaloInvalido ? `Mínimo ${INTERVALO_MINIMO} segundos.` : 'Quanto menor, mais bateria o celular gasta. 60 é um bom meio-termo.'}
            sx={{ maxWidth: 320 }}
            slotProps={{ htmlInput: { min: INTERVALO_MINIMO, step: 10 } }}
          />

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              O promotor pode desligar?
            </Typography>
            <RadioGroup value={exigencia} onChange={(e) => setExigencia(e.target.value as Exigencia)}>
              {EXIGENCIAS.map((op) => (
                <FormControlLabel
                  key={op.valor}
                  value={op.valor}
                  control={<Radio size="small" />}
                  sx={{ alignItems: 'flex-start', mb: 0.75, '& .MuiRadio-root': { pt: 0.25 } }}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {op.titulo}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {op.descricao}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
          </Box>

          <Divider />

          <Box>
            <FormControlLabel
              control={<Switch checked={soNaJornada} onChange={(e) => setSoNaJornada(e.target.checked)} />}
              label="Só durante o expediente"
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: soNaJornada ? 1.5 : 0 }}>
              Fora desse horário o app não cobra nada do promotor e o rastreamento desliga. Desligue pra testar fora do horário.
            </Typography>
            {soNaJornada && (
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <TextField label="Início" type="time" size="small" value={inicio} onChange={(e) => setInicio(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField
                  label="Fim"
                  type="time"
                  size="small"
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  error={jornadaInvalida}
                  helperText={jornadaInvalida ? 'O fim precisa ser depois do início.' : 'Mesma jornada da Operação do Dia.'}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Box>
            )}
          </Box>

          <Divider />

          <Box>
            <FormControlLabel
              control={<Switch checked={painel} onChange={(e) => setPainel(e.target.checked)} />}
              label="Mostrar no Mapa ao vivo quem está irregular"
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Lista os promotores sem permissão, com GPS desligado ou sem sinal, e o motivo.
            </Typography>
          </Box>
        </Box>
      </Collapse>

      {mutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Não foi possível salvar a configuração.
        </Alert>
      )}
      {salvo && !mutation.isPending && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSalvo(false)}>
          Configuração salva. O app aplica na próxima vez que o promotor abrir ou voltar pro aplicativo.
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button
          variant="contained"
          disabled={mutation.isPending || intervaloInvalido || (ligado && jornadaInvalida)}
          onClick={() => {
            setSalvo(false);
            mutation.mutate();
          }}
        >
          {mutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </Box>
    </Paper>
  );
}
