// src/modules/financeiro/utils/printHelper.ts

/**
 * Impressão fiel ao preview: clona o elemento no topo do body (fluxo estático),
 * oculta-o na tela via @media screen, e mostra apenas durante impressão.
 * Sem cleanup após window.print() para evitar problemas de timing no Tauri.
 * O wrapper anterior é removido no início de cada nova chamada.
 */
export function dispararImpressaoFiel(elementId: string, titulo?: string) {
  const el = document.getElementById(elementId);
  if (!el) {
    console.warn(`[Impressão] Elemento #${elementId} não encontrado.`);
    return;
  }

  // Remove wrapper de chamada anterior, se existir
  document.getElementById('__print-fiel-wrapper__')?.remove();

  const clone = el.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';
  clone.style.maxWidth = 'none';
  clone.style.width = '100%';
  clone.style.margin = '0';
  clone.style.padding = '0';
  clone.querySelectorAll('button').forEach(b => b.remove());

  // Esconde o wrapper da tela via posição off-screen (evita @media screen
  // que o WKWebView do Tauri aplica também durante a impressão)
  const wrapper = document.createElement('div');
  wrapper.id = '__print-fiel-wrapper__';
  wrapper.style.cssText = 'position:absolute;top:-99999px;left:-99999px;width:1px;height:1px;overflow:hidden;';
  wrapper.appendChild(clone);
  document.body.insertBefore(wrapper, document.body.firstChild);

  let estiloImpressao = document.getElementById('estilo-impressao-fiel');
  if (!estiloImpressao) {
    estiloImpressao = document.createElement('style');
    estiloImpressao.id = 'estilo-impressao-fiel';
    document.head.appendChild(estiloImpressao);
  }
  estiloImpressao.innerHTML = `
    @media print {
      @page { size: A4 portrait; margin: 10mm; }
      body > *:not(#__print-fiel-wrapper__) { display: none !important; }
      #__print-fiel-wrapper__ {
        position: static !important;
        top: auto !important;
        left: auto !important;
        width: 100% !important;
        height: auto !important;
        overflow: visible !important;
        display: block !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      table { width: 100% !important; table-layout: auto !important; }
    }
  `;

  const tituloAnterior = document.title;
  if (titulo) document.title = titulo;

  setTimeout(() => {
    window.print();
    document.title = tituloAnterior;
  }, 250);
}

export function dispararImpressaoA4(elementId: string, fonteSelecionada: string = "Arial") {
  try {
    // 1. Localiza o elemento da folha A4 (ex: papel-formacao, papel-eventos, etc.)
    const meuPapel = document.getElementById(elementId);
    if (!meuPapel) {
      console.warn(`[Impressão] Elemento #${elementId} não encontrado.`);
      return;
    }

    // 2. Cria ou atualiza uma tag <style> global para controlar as regras de impressão física
    let estiloImpressao = document.getElementById("estilo-impressao-dinamico");
    if (!estiloImpressao) {
      estiloImpressao = document.createElement("style");
      estiloImpressao.id = "estilo-impressao-dinamico";
      document.head.appendChild(estiloImpressao);
    }

    // 3. REGRA DE OURO DO MAC: Esconde tudo o que está na tela, EXCETO o papel selecionado
    estiloImpressao.innerHTML = `
      @media print {
        /* Remove do layout (não só invisível) seções marcadas como "não imprimir" —
           formulários grandes com muitos textarea/input podem travar a pré-visualização
           nativa de impressão do WebKit se apenas ocultados por visibility. */
        .no-imprimir {
          display: none !important;
        }

        /* Esconde absolutamente toda a interface do aplicativo */
        body * {
          visibility: hidden !important;
        }

        /* Torna visível única e exclusivamente o container do papel A4 e os seus filhos */
        #${elementId}, #${elementId} * {
          visibility: visible !important;
        }
        
        /* Força o papel a colar no topo esquerdo da página física de impressão */
        #${elementId} {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 210mm !important;
          min-height: 297mm !important;
          padding: 15mm !important;
          box-shadow: none !important;
          background: white !important;
          font-family: "${fonteSelecionada}", serif !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Ajustes universais para tabelas saírem nítidas na folha */
        table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
        /* Sem "color" forçado aqui: preserva a cor definida por célula (ex.: Programa de Missas) */
        th, td { border: 1px solid #000 !important; padding: 10px !important; text-align: center !important; vertical-align: middle !important; font-size: 11px !important; white-space: pre-wrap !important; }
        th { color: #000 !important; }
        th { background-color: #f2f2f2 !important; font-weight: bold !important; }
        h2 { text-align: center !important; text-transform: uppercase !important; color: #1f3b73 !important; }
        .conteudo-box { background: #fcfcfd !important; padding: 15px !important; border-radius: 8px !important; border: 1px solid #eaecf0 !important; }
      }
    `;

    // 4. Executa o comando de impressão diretamente na janela atual
    // O Mac não bloqueia porque não há pop-up intermediário!
    window.print();

  } catch (erro) {
    console.error("[Impressão] Erro no fluxo de estilo de impressão:", erro);
  }
}