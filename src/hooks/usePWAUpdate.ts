import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Hook que detecta quando há uma nova versão do app disponível via Service Worker.
 * Expõe `needsUpdate` e `applyUpdate()` para forçar a atualização.
 */
export function usePWAUpdate() {
  const {
    needRefresh: [needsUpdate, setNeedsUpdate],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Verificar por atualizações a cada 60 segundos enquanto o app estiver aberto
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error("SW registration error", error);
    },
  });

  const applyUpdate = () => {
    updateServiceWorker(true);
  };

  const dismissUpdate = () => {
    setNeedsUpdate(false);
  };

  return { needsUpdate, applyUpdate, dismissUpdate };
}
