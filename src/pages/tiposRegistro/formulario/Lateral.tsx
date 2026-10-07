import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useWatch, type Control } from 'react-hook-form';
import { listarCampanhas } from '../../../lib/api/campanhas';
import { listarRedesLojas } from '../../../lib/api/redesLojas';
import { quandoAparece, sobreOQue, type FormData } from './modelo';
import { PreviaApp } from './PreviaApp';
import { horus } from '../../../theme';

/**
 * Lateral fixa do editor (protótipo "Formulário — revisão de UX"): um resumo em linguagem de gente
 * do que o formulário faz, alertas de configuração, e a prévia do app do promotor. Os dois se
 * atualizam enquanto edita (useWatch aqui dentro — o resto da página não re-renderiza por isso).
 */
export function Lateral({ control }: { control: Control<FormData> }) {
  const d = useWatch({ control }) as FormData;
  return (
    <Box sx={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Resumo d={d} />
      <PreviaApp d={d} />
    </Box>
  );
}

function Resumo({ d }: { d: FormData }) {
  const quando = quandoAparece(d);
  const campanhasQuery = useQuery({
    queryKey: ['campanhas', { ativo: true }],
    queryFn: () => listarCampanhas(true),
    enabled: quando === 'CAMPANHA',
  });
  const redesQuery = useQuery({
    queryKey: ['redes-lojas', 'escopo-acao'],
    queryFn: () => listarRedesLojas({ ativo: true, por_pagina: 200 }),
    enabled: quando === 'LOJA_REDE',
  });

  const campos = d.campos ?? [];
  const obrigatorias = campos.filter((c) => c.obrigatorio);
  const produtos = d.produtos_predefinidos ?? [];
  const sobre = sobreOQue(d);

  const onde: ReactNode = (() => {
    switch (quando) {
      case 'LIVRE':
        return <>Fica no menu <b>Registro geral</b>, em qualquer loja — o promotor usa quando quiser.</>;
      case 'SO_CAMPANHAS':
        return <>Não aparece sozinho: entra <b>dentro de campanhas</b>.</>;
      case 'SEMPRE':
        return <>Em <b>toda visita</b>, o promotor tem uma pendência obrigatória</>;
      case 'CONTRATO':
        return <>Nas lojas <b>com contrato ativo</b>, o promotor tem uma pendência obrigatória</>;
      case 'CAMPANHA': {
        const nome = campanhasQuery.data?.campanhas.find((c) => c.id === d.campanha_auditoria_uuid)?.descricao;
        return <>Nas visitas da campanha <b>{nome ?? '(escolha a campanha)'}</b>, o promotor tem uma pendência obrigatória</>;
      }
      case 'LOJA_REDE': {
        const redes = (redesQuery.data?.redes_lojas ?? []).filter((r) => d.redes_lojas_uuids.includes(r.id)).map((r) => r.descricao);
        const lojas = d.pontos_venda_escopo.length;
        const partes = [
          redes.length ? `${redes.length === 1 ? 'da rede' : 'das redes'} ${redes.join(', ')}` : null,
          lojas ? `${lojas} loja${lojas === 1 ? '' : 's'} avulsa${lojas === 1 ? '' : 's'}` : null,
        ].filter(Boolean);
        return partes.length ? (
          <>Nas lojas <b>{partes.join(' + ')}</b>, o promotor tem uma pendência obrigatória</>
        ) : (
          <>Em <b>todas as lojas</b> (nenhuma rede/loja escolhida ainda), o promotor tem uma pendência obrigatória</>
        );
      }
    }
  })();

  const alvo =
    sobre === 'PRODUTO'
      ? produtos.length
        ? <> de <b>cada um dos {produtos.length} produtos</b></>
        : <> de <b>cada produto</b></>
      : sobre === 'LINHA'
        ? <> para a <b>linha/seção inteira</b></>
        : null;

  const oque: ReactNode = campos.length === 0 ? (
    <>{d.exige_foto ? 'tirar a foto' : 'registrar'}</>
  ) : obrigatorias.length === 1 ? (
    <>informar <b>{obrigatorias[0].rotulo.toLowerCase() || 'a pergunta'}</b></>
  ) : (
    <>responder <b>{campos.length} pergunta{campos.length === 1 ? '' : 's'}</b></>
  );

  const avisos: string[] = [];
  if (campos.length > 0 && obrigatorias.length === 0) avisos.push('Nenhuma pergunta é obrigatória — o promotor pode enviar o formulário em branco.');
  if (sobre === 'PRODUTO' && produtos.length === 0) avisos.push('Nenhum produto na lista — o promotor escolhe entre os produtos do mix da loja.');
  if (campos.length === 0 && !d.exige_foto) avisos.push('Sem perguntas e sem foto — não tem nada pra coletar.');

  const obrigatorio = quando !== 'LIVRE' && quando !== 'SO_CAMPANHAS';

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
        Resumo
      </Typography>
      <Typography variant="body2" sx={{ lineHeight: 1.6, mt: 0.5 }}>
        {onde}
        {obrigatorio && (
          <>
            : {oque}
            {alvo}
          </>
        )}
        {obrigatorio ? '. ' : ' '}
        {d.exige_foto ? 'Com foto.' : 'Sem foto.'}
      </Typography>
      {avisos.map((a) => (
        <Box key={a} sx={{ display: 'flex', gap: 1, mt: 1.5, p: 1.25, borderRadius: 2, bgcolor: horus.ambarClaro, color: horus.ambarEscuro }}>
          <WarningAmberIcon sx={{ fontSize: 18, mt: 0.1 }} />
          <Typography variant="caption">{a}</Typography>
        </Box>
      ))}
    </Paper>
  );
}
