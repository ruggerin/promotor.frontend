import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

// scrollWheelZoom fica ligado no Leaflet o tempo todo, mas um filtro na frente barra o wheel
// comum (sem Ctrl/Cmd) antes dele chegar no handler interno — `stopImmediatePropagation` some
// com o evento pros listeners seguintes no MESMO elemento, e como este listener é registrado
// ANTES de `scrollWheelZoom.enable()` (que é quem pluga o listener interno do Leaflet nesse
// mesmo container), o nosso sempre roda primeiro. Mais simples e mais robusto que ligar/desligar
// o handler a cada tecla: não tem estado nenhum pra dessincronizar (ex.: soltar Ctrl fora da
// janela do mapa e perder o keyup) — cada evento de wheel decide sozinho, olhando só o
// modificador que ELE carrega. `preventDefault` no caso Ctrl+wheel evita o navegador tentar dar
// zoom na página inteira ao mesmo tempo (atalho nativo do browser).
export function ZoomComCtrl() {
  const mapa = useMap();
  useEffect(() => {
    const container = mapa.getContainer();
    function aoRolar(evento: WheelEvent) {
      if (evento.ctrlKey || evento.metaKey) {
        evento.preventDefault();
        return;
      }
      evento.stopImmediatePropagation();
    }
    container.addEventListener('wheel', aoRolar, { passive: false });
    mapa.scrollWheelZoom.enable();
    return () => {
      container.removeEventListener('wheel', aoRolar);
      mapa.scrollWheelZoom.disable();
    };
  }, [mapa]);
  return null;
}
