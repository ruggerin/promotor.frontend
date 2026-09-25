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
import { DirecionamentoDetailPage } from './pages/direcionamentos/DirecionamentoDetailPage';
import { DirecionamentosListPage } from './pages/direcionamentos/DirecionamentosListPage';
import { EmpresaDetailPage } from './pages/empresas/EmpresaDetailPage';
import { EmpresasListPage } from './pages/empresas/EmpresasListPage';
import { GaleriaFotosPage } from './pages/galeriaFotos/GaleriaFotosPage';
import { ManualPage } from './pages/manual/ManualPage';
import { ObjetivosVisitaListPage } from './pages/objetivosVisita/ObjetivosVisitaListPage';
import { OperacaoDoDiaPage } from './pages/operacaoDoDia/OperacaoDoDiaPage';
import { OrdensServicoListPage } from './pages/ordensServico/OrdensServicoListPage';
import { ParametrosListPage } from './pages/parametros/ParametrosListPage';
import { PerfisListPage } from './pages/perfis/PerfisListPage';
import { PlanejadorVisitasPage } from './pages/planejadorVisitas/PlanejadorVisitasPage';
import { PlanoAcaoDetailPage } from './pages/planosAcao/PlanoAcaoDetailPage';
import { PlanosAcaoListPage } from './pages/planosAcao/PlanosAcaoListPage';
import { RespostasFormularioPage } from './pages/relatorios/RespostasFormularioPage';
import { VisitasPlanejadasPage } from './pages/relatorios/VisitasPlanejadasPage';
import { RastreamentoPage } from './pages/rastreamento/RastreamentoPage';
import { PlanogramaEditorPage } from './pages/planogramas/PlanogramaEditorPage';
import { PlanogramasListPage } from './pages/planogramas/PlanogramasListPage';
import { PontoVendaDetailPage } from './pages/pontosVenda/PontoVendaDetailPage';
import { PontosVendaListPage } from './pages/pontosVenda/PontosVendaListPage';
import { RamosAtividadeListPage } from './pages/ramosAtividade/RamosAtividadeListPage';
import { RedesLojasListPage } from './pages/redesLojas/RedesLojasListPage';
import { TipoRegistroFormPage } from './pages/tiposRegistro/TipoRegistroFormPage';
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
          <Route path="/operacao-do-dia" element={<OperacaoDoDiaPage />} />
          <Route path="/visitas" element={<VisitasListPage />} />
          <Route path="/visitas/:publicId" element={<VisitaDetailPage />} />
          <Route path="/pontos-venda" element={<PontosVendaListPage />} />
          <Route path="/atividades" element={<AtividadesPage />} />
          <Route path="/galeria-fotos" element={<GaleriaFotosPage />} />
          {/* Planos de Ação (docs/37-PLANOS-DE-ACAO.md) — nascem de um alerta no Painel de
              Atividades; a criação é um diálogo lá, não uma rota própria. */}
          <Route path="/planos-acao" element={<PlanosAcaoListPage />} />
          <Route path="/planos-acao/:publicId" element={<PlanoAcaoDetailPage />} />
          <Route path="/pontos-venda/:publicId" element={<PontoVendaDetailPage />} />
          <Route path="/catalogo" element={<CatalogoPage />} />
          <Route path="/redes-lojas" element={<RedesLojasListPage />} />
          <Route path="/ramos-atividade" element={<RamosAtividadeListPage />} />
          <Route path="/tipos-registro" element={<TiposRegistroListPage />} />
          {/* Rota estática antes da dinâmica — mesmo padrão de /contratos/novo. */}
          <Route path="/tipos-registro/novo" element={<TipoRegistroFormPage />} />
          <Route path="/tipos-registro/:publicId" element={<TipoRegistroFormPage />} />
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
          <Route path="/direcionamentos" element={<DirecionamentosListPage />} />
          <Route path="/direcionamentos/:publicId" element={<DirecionamentoDetailPage />} />
          <Route path="/agendas-visita" element={<AgendasVisitaListPage />} />
          <Route path="/planejador-visitas" element={<PlanejadorVisitasPage />} />
          <Route path="/rastreamento" element={<RastreamentoPage />} />
          <Route path="/relatorios/visitas-planejadas" element={<VisitasPlanejadasPage />} />
          <Route path="/relatorios/respostas-formulario" element={<RespostasFormularioPage />} />
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
          <Route path="/manual" element={<ManualPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
