import { Autocomplete, Box, Checkbox, FormControlLabel, TextField } from '@mui/material';
import type { ResponsavelPlanoAcao } from '../../lib/api/planosAcao';
import type { EtapaForm } from './etapaForm';

// Campos de uma etapa — usados tanto ao abrir o plano (lista de etapas) quanto no
// "+ Adicionar etapa" do detalhe. Responsável do sistema e/ou ator externo (vendedor, motorista):
// o externo nunca usa o sistema, alguém com "movimentar etapa" acompanha por ele (docs/37 §6).

const ROTULO_TIPO: Record<string, string> = { ADMIN: 'Admin', GESTOR: 'Gestor', PROMOTOR: 'Promotor' };

export function EtapaCampos({
  etapa,
  responsaveis,
  onChange,
}: {
  etapa: EtapaForm;
  responsaveis: ResponsavelPlanoAcao[];
  onChange: (etapa: EtapaForm) => void;
}) {
  const set = <K extends keyof EtapaForm>(campo: K, valor: EtapaForm[K]) => onChange({ ...etapa, [campo]: valor });

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 1.5 }}>
      <TextField
        size="small"
        label="Título da etapa"
        required
        value={etapa.titulo}
        onChange={(e) => set('titulo', e.target.value)}
      />
      <TextField
        size="small"
        label="Prazo"
        type="date"
        value={etapa.prazo}
        onChange={(e) => set('prazo', e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <Autocomplete
        size="small"
        options={responsaveis}
        groupBy={(o) => ROTULO_TIPO[o.user_type] ?? o.user_type}
        getOptionLabel={(o) => o.nome}
        value={responsaveis.find((r) => r.id === etapa.responsavel_uuid) ?? null}
        onChange={(_, v) => set('responsavel_uuid', v?.id ?? null)}
        renderInput={(params) => <TextField {...params} label="Responsável (usuário do sistema)" />}
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={etapa.evidencia_obrigatoria}
            onChange={(e) => set('evidencia_obrigatoria', e.target.checked)}
          />
        }
        label="Exige evidência"
        title="Para marcar como feita, precisa informar um texto (nº do pedido, NF...) ou anexar um arquivo"
      />
      <TextField
        size="small"
        label="Responsável externo (opcional)"
        placeholder="Ex.: Carlos Andrade — vendedor"
        value={etapa.responsavel_externo_nome}
        onChange={(e) => set('responsavel_externo_nome', e.target.value)}
      />
      <TextField
        size="small"
        label="Contato do externo"
        placeholder="Telefone/e-mail"
        value={etapa.responsavel_externo_contato}
        onChange={(e) => set('responsavel_externo_contato', e.target.value)}
      />
      <TextField
        size="small"
        label="Descrição / instruções (opcional)"
        multiline
        minRows={1}
        value={etapa.descricao}
        onChange={(e) => set('descricao', e.target.value)}
        sx={{ gridColumn: '1 / -1' }}
      />
    </Box>
  );
}
