import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

export function PWAUpdateBanner() {
  const { needsUpdate, applyUpdate, dismissUpdate } = usePWAUpdate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (needsUpdate) {
      // Pequeno delay para a animação de entrada aparecer
      const t = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [needsUpdate]);

  if (!needsUpdate) return null;

  return (
    <div
      className={`
        fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999]
        transition-all duration-500 ease-out
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
      `}
      style={{ width: "min(420px, calc(100vw - 2rem))" }}
    >
      <div
        className="relative flex items-center gap-3 p-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1a1f2e 0%, #252d3d 100%)",
          border: "1px solid rgba(99, 179, 237, 0.25)",
          boxShadow:
            "0 25px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,179,237,0.1), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Brilho sutil no topo */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(99,179,237,0.5), transparent)",
          }}
        />

        {/* Ícone animado */}
        <div
          className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl"
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
            boxShadow: "0 4px 15px rgba(59,130,246,0.4)",
          }}
        >
          <RefreshCw className="w-5 h-5 text-white animate-spin-slow" />
        </div>

        {/* Texto */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">
            🚀 Nova versão disponível!
          </p>
          <p className="text-xs text-blue-300 mt-0.5 leading-tight">
            Atualize para ter os recursos mais recentes.
          </p>
        </div>

        {/* Botões */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={applyUpdate}
            className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-all duration-200 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
              boxShadow: "0 2px 10px rgba(59,130,246,0.4)",
            }}
          >
            Atualizar
          </button>
          <button
            onClick={dismissUpdate}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-blue-400 hover:text-white hover:bg-white/10 transition-all duration-200"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
