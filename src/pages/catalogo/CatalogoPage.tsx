import { Autocomplete, Box, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { listarEmpresasSuperadmin } from '../../lib/api/empresas';
import { useAuth } from '../../lib/auth/AuthContext';
import { DepartamentosTab } from './DepartamentosTab';
import { MarcasTab } from './MarcasTab';
import { NiveisExibicaoTab } from './NiveisExibicaoTab';
import { ProdutosTab } from './ProdutosTab';
import { SecoesTab } from './SecoesTab';
import { TiposRegistroTab } from './TiposRegistroTab';

const ABAS = ['departamentos', 'secoes', 'marcas', 'produtos', 'niveis', 'tipos-registro'] as const;
type Aba = (typeof ABAS)[number];

export function CatalogoPage() {
  const { usuario } = useAuth();
  // Catálogo é dado próprio de cada empresa (BelongsToEmpresa) — pro SUPERADMIN, que não
  // pertence a empresa nenhuma, a listagem viria misturando itens de todas as empresas sem
  // filtro nenhum. Mesmo padrão de UsuariosListPage: filtro de empresa + coluna extra, mas aqui
  // é somente leitura — a API bloqueia SUPERADMIN de criar/editar/desativar catálogo (ver
  // App\Http\Middleware\EnsurePermissao), então os botões de ação ficam escondidos pra ele.
  const isSuperadmin = usuario?.user_type === 'SUPERADMIN';
  const [aba, setAba] = useState<Aba>('departamentos');
  const [filtroEmpresaUuid, setFiltroEmpresaUuid] = useState<string | null>(null);

  const empresasQuery = useQuery({
    queryKey: ['empresas', 'superadmin'],
    queryFn: listarEmpresasSuperadmin,
    enabled: isSuperadmin,
  });

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Catálogo
      </Typography>

      {isSuperadmin && (
        <Autocomplete
          size="small"
          sx={{ width: 280, mb: 2 }}
          options={empresasQuery.data?.empresas ?? []}
          getOptionLabel={(option) => option.nome_fantasia}
          loading={empresasQuery.isLoading}
          onChange={(_, value) => setFiltroEmpresaUuid(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Empresa" placeholder="Todas as empresas" />}
        />
      )}

      <Tabs value={aba} onChange={(_, value: Aba) => setAba(value)} sx={{ mb: 2 }}>
        <Tab label="Departamentos" value="departamentos" />
        <Tab label="Seções" value="secoes" />
        <Tab label="Marcas" value="marcas" />
        <Tab label="Produtos" value="produtos" />
        <Tab label="Níveis de Exibição" value="niveis" />
        <Tab label="Tipos de Registro" value="tipos-registro" />
      </Tabs>

      {aba === 'departamentos' && <DepartamentosTab empresaUuid={filtroEmpresaUuid} isSuperadmin={isSuperadmin} />}
      {aba === 'secoes' && <SecoesTab empresaUuid={filtroEmpresaUuid} isSuperadmin={isSuperadmin} />}
      {aba === 'marcas' && <MarcasTab empresaUuid={filtroEmpresaUuid} isSuperadmin={isSuperadmin} />}
      {aba === 'produtos' && <ProdutosTab empresaUuid={filtroEmpresaUuid} isSuperadmin={isSuperadmin} />}
      {aba === 'niveis' && <NiveisExibicaoTab empresaUuid={filtroEmpresaUuid} isSuperadmin={isSuperadmin} />}
      {aba === 'tipos-registro' && <TiposRegistroTab empresaUuid={filtroEmpresaUuid} isSuperadmin={isSuperadmin} />}
    </Box>
  );
}
