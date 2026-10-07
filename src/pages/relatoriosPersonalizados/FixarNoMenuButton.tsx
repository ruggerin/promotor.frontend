import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import { Checkbox, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState, type MouseEvent } from 'react';
import { fixarRelatorioNoMenu, type AlcanceFixado, type RelatorioPersonalizado } from '../../lib/api/relatoriosPersonalizados';
import { useAuth } from '../../lib/auth/AuthContext';
import { horus } from '../../theme';

function mensagemDeErro(erro: unknown, padrao: string): string {
  return axios.isAxiosError<{ message?: string }>(erro) ? (erro.response?.data.message ?? padrao) : padrao;
}

/**
 * "Mostrar no menu" (docs/63 §1.7): no meu menu (qualquer relatório que eu vejo) e no menu da
 * empresa (padrão/compartilhado, só com relatorios.personalizados.gerenciar).
 */
export function FixarNoMenuButton({ relatorio, tamanho = 'medium' }: { relatorio: RelatorioPersonalizado; tamanho?: 'small' | 'medium' }) {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const [ancora, setAncora] = useState<HTMLElement | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const podeEmpresa =
    (usuario?.user_type === 'ADMIN' || (usuario?.perfil?.permissoes ?? []).includes('relatorios.personalizados.gerenciar')) &&
    (relatorio.padrao || relatorio.compartilhado);
  const fixado = relatorio.fixado_empresa || Boolean(relatorio.fixado_meu);

  const mutacao = useMutation({
    mutationFn: ({ alcance, valor }: { alcance: AlcanceFixado; valor: boolean }) => fixarRelatorioNoMenu(relatorio.id, alcance, valor),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({
        queryKey: ['relatorios-personalizados'],
      });
    },
    onError: (e) => setErro(mensagemDeErro(e, 'Não foi possível alterar o menu.')),
  });

  function abrir(e: MouseEvent<HTMLElement>) {
    e.stopPropagation();
    setErro(null);
    setAncora(e.currentTarget);
  }

  return (
    <>
      <Tooltip title={fixado ? 'Fixado no menu' : 'Mostrar no menu'}>
        <IconButton size={tamanho} onClick={abrir} aria-label="Mostrar no menu" sx={{ color: fixado ? horus.indigo : 'text.secondary' }}>
          {fixado ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Menu anchorEl={ancora} open={Boolean(ancora)} onClose={() => setAncora(null)} onClick={(e) => e.stopPropagation()}>
        <MenuItem disabled={mutacao.isPending} onClick={() => mutacao.mutate({ alcance: 'meu', valor: !relatorio.fixado_meu })}>
          <ListItemIcon>
            <Checkbox edge="start" size="small" checked={Boolean(relatorio.fixado_meu)} tabIndex={-1} disableRipple />
          </ListItemIcon>
          <ListItemText primary="No meu menu" secondary="Só você vê" />
        </MenuItem>
        {podeEmpresa && (
          <MenuItem
            disabled={mutacao.isPending}
            onClick={() =>
              mutacao.mutate({
                alcance: 'empresa',
                valor: !relatorio.fixado_empresa,
              })
            }
          >
            <ListItemIcon>
              <Checkbox edge="start" size="small" checked={relatorio.fixado_empresa} tabIndex={-1} disableRipple />
            </ListItemIcon>
            <ListItemText primary="No menu da empresa" secondary="Todos que veem relatórios" />
          </MenuItem>
        )}
        {erro && (
          <MenuItem
            disabled
            sx={{
              whiteSpace: 'normal',
              maxWidth: 280,
              fontSize: 12.5,
              color: 'error.main',
              opacity: '1 !important',
            }}
          >
            {erro}
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
