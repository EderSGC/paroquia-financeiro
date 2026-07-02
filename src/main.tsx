import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ErrorBoundary } from "./core/ui/ErrorBoundary";
import { logger } from "./core/utils/logger";
import App from "./App";

// Aplica paleta salva antes do primeiro render para evitar flash
const savedPalette = localStorage.getItem("paleta");
if (savedPalette && savedPalette !== "azul") {
  document.documentElement.setAttribute("data-palette", savedPalette);
}

async function bootstrap() {
  const rootElement =
    document.getElementById("root");

  if (!rootElement) {
    throw new Error(
      "Elemento #root não encontrado."
    );
  }

  const root =
    createRoot(rootElement);

  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );

  logger.log(
    "✅ Financeiro Paroquial iniciado."
  );
}

bootstrap().catch((error) => {
  console.error(
    "❌ Erro ao iniciar aplicação:",
    error
  );

  const container = document.createElement("div");
  container.style.cssText = "height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:system-ui;text-align:center;padding:24px;";
  const h1 = document.createElement("h1");
  h1.textContent = "Erro ao iniciar o sistema";
  const p = document.createElement("p");
  p.textContent = String(error);
  container.appendChild(h1);
  container.appendChild(p);
  document.body.replaceChildren(container);
});