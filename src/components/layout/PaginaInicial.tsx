import { Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { CONTADORES_ZERADOS, filtrarVisiveis, montarMenu } from './menuAdmin';

/**
 * "/" leva pra Visitas, como sempre; se o perfil não vê Visitas (docs/64), pra primeira tela que
 * ele vê no menu.
 */
export function PaginaInicial() {
  const { usuario } = useAuth();
  const caminhos = filtrarVisiveis(montarMenu(usuario, CONTADORES_ZERADOS)).flatMap((g) => g.itens.map((i) => i.caminho));
  const destino = caminhos.includes('/visitas') ? '/visitas' : (caminhos[0] ?? '/manual');
  return <Navigate to={destino} replace />;
}
