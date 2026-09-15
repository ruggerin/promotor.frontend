import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { RequireAuth } from './lib/auth/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { AgendasVisitaListPage } from './pages/agendasVisita/AgendasVisitaListPage';
import { AtividadesPage } from './pages/atividades/AtividadesPage';
import { CampanhaDetailPage } from './pages/campanhas/CampanhaDetailPage';
import { CampanhasListPage } from './pages/campanhas/CampanhasListPage';
import { CatalogoPage } from './pages/catalogo/CatalogoPage';
import { CentrosCustoListPage } from './pages/centrosCusto/CentrosCustoListPage';
import { ContratoDetailPage } from './pages/contratos/ContratoDetailPage';
import { ContratosListPage } from './pages/contratos/ContratosListPage';
import { EmpresaDetailPage } from './pages/empresas/EmpresaDetailPage';
import { EmpresasListPage } from './pages/empresas/EmpresasListPage';
import { ObjetivosVisitaListPage } from './pages/objetivosVisita/ObjetivosVisitaListPage';
import { OrdensServicoListPage } from './pages/ordensServico/OrdensServicoListPage';
import { ParametrosListPage } from './pages/parametros/ParametrosListPage';
import { PerfisListPage } from './pages/perfis/PerfisListPage';
import { PlanogramaEditorPage } from './pages/planogramas/PlanogramaEditorPage';
import { PlanogramasListPage } from './pages/planogramas/PlanogramasListPage';
import { PontoVendaDetailPage } from './pages/pontosVenda/PontoVendaDetailPage';
import { PontosVendaListPage } from './pages/pontosVenda/PontosVendaListPage';
import { TiposRegistroListPage } from './pages/tiposRegistro/TiposRegistroListPage';
import { TiposVisitaListPage } from './pages/tiposVisita/TiposVisitaListPage';
import { UsuarioDetailPage } from './pages/usuarios/UsuarioDetailPage';
import { UsuariosListPage } from './pages/usuarios/UsuariosListPage';
import { VisitaDetailPage } from './pages/visitas/VisitaDetailPage';
import { VisitasListPage } from './pages/visitas/VisitasListPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/visitas" replace />} />
          <Route path="/visitas" element={<VisitasListPage />} />
          <Route path="/visitas/:publicId" element={<VisitaDetailPage />} />
          <Route path="/pontos-venda" element={<PontosVendaListPage />} />
          <Route path="/atividades" element={<AtividadesPage />} />
          <Route path="/pontos-venda/:publicId" element={<PontoVendaDetailPage />} />
          <Route path="/catalogo" element={<CatalogoPage />} />
          <Route path="/tipos-registro" element={<TiposRegistroListPage />} />
          <Route path="/planogramas" element={<PlanogramasListPage />} />
          <Route path="/planogramas/:publicId" element={<PlanogramaEditorPage />} />
          <Route path="/campanhas" element={<CampanhasListPage />} />
          <Route path="/campanhas/:publicId" element={<CampanhaDetailPage />} />
          <Route path="/contratos" element={<ContratosListPage />} />
          {/* Rota estática antes da dinâmica — o React Router já prioriza a mais específica
              independente da ordem, mas assim fica óbvio pra quem lê. */}
          <Route path="/contratos/novo" element={<ContratoDetailPage />} />
          <Route path="/contratos/:publicId" element={<ContratoDetailPage />} />
          <Route path="/ordens-servico" element={<OrdensServicoListPage />} />
          <Route path="/agendas-visita" element={<AgendasVisitaListPage />} />
          <Route path="/tipos-visita" element={<TiposVisitaListPage />} />
          <Route path="/objetivos-visita" element={<ObjetivosVisitaListPage />} />
          <Route path="/centros-custo" element={<CentrosCustoListPage />} />
          <Route path="/usuarios" element={<UsuariosListPage />} />
          <Route path="/usuarios/:publicId" element={<UsuarioDetailPage />} />
          <Route path="/parametros" element={<ParametrosListPage />} />
          {/* Sem guarda de rota própria — a API já bloqueia tudo (403) pra quem não é
              ADMIN/SUPERADMIN, e o link só aparece no menu pro user_type certo (ver
              AppLayout). */}
          <Route path="/perfis" element={<PerfisListPage />} />
          <Route path="/empresas" element={<EmpresasListPage />} />
          <Route path="/empresas/:publicId" element={<EmpresaDetailPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
