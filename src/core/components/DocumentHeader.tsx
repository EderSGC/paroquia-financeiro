import { AppLogo } from "../ui/AppLogo";
import type { Paroquia } from "../types/app.types";

interface DocumentHeaderProps {
  paroquia: Paroquia;
}

function splitParoquiaName(nome: string) {
  const normalized = nome.trim();

  if (!normalized) {
    return {
      principal: "Área Missionária",
      secundario: "Nome da Comunidade",
    };
  }

  const prefixes = ["Área Missionária", "Paróquia", "Comunidade", "Santuário", "Catedral"];
  const foundPrefix = prefixes.find((prefix) => normalized.startsWith(`${prefix} `));

  if (!foundPrefix) {
    return { principal: normalized, secundario: "" };
  }

  return {
    principal: foundPrefix,
    secundario: normalized.slice(foundPrefix.length).trim(),
  };
}

export function DocumentHeader({ paroquia }: DocumentHeaderProps) {
  const tituloParoquia = splitParoquiaName(paroquia.nome);
  const linhaCidade = [paroquia.cep, paroquia.cidade, paroquia.estado].filter(Boolean).join(" - ");

  return (
    <div
      className="cabecalho-impressao-oficial"
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr 100px",
        gap: 20,
        alignItems: "center", // Alinha logos e texto perfeitamente ao centro vertical
        borderBottom: "2px solid #1f3b73", // Linha inferior com a cor principal (mais elegante)
        paddingBottom: 20,
        marginBottom: 20,
      }}
    >
      {/* Logo Esquerda (Área Missionária) */}
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <AppLogo
          logoPath={paroquia.logo_path}
          alt="Logo da paróquia"
          size={85}
          radius={0} // Geralmente logos oficiais não usam bordas arredondadas na impressão
          fallbackText="P"
          background="white"
          padding={0}
        />
      </div>

      {/* Texto Central Escalonado */}
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "2px" }}>
        <div style={{ color: "#475467", fontSize: 13, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>
          {paroquia.diocese || "Arquidiocese de Manaus"}
        </div>
        
        <div style={{ color: "#1f3b73", fontSize: 16, fontWeight: 800, textTransform: "uppercase", marginTop: 4 }}>
          {tituloParoquia.principal}
        </div>
        
        {tituloParoquia.secundario && (
          <div style={{ color: "#1f3b73", fontSize: 20, fontWeight: 800, textTransform: "uppercase" }}>
            {tituloParoquia.secundario}
          </div>
        )}
        
        {/* Bloco de Contatos Escalonado (Uma linha abaixo da outra) */}
        <div style={{ 
          color: "#344054", 
          fontSize: 12, 
          marginTop: 10, 
          lineHeight: 1.4, 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center" 
        }}>
          {paroquia.endereco && <span>{paroquia.endereco}</span>}
          {linhaCidade && <span>{linhaCidade}</span>}
          {paroquia.email && <span>{paroquia.email}</span>}
          {paroquia.telefone && <span>{paroquia.telefone}</span>}
          {paroquia.cnpj && <span>CNPJ: {paroquia.cnpj}</span>}
        </div>
      </div>

      {/* Logo Direita (Arquidiocese) */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <AppLogo
          logoPath={paroquia.diocese_logo_path}
          alt="Logo da diocese"
          size={85}
          radius={0}
          fallbackText="D"
          background="white"
          padding={0}
        />
      </div>
    </div>
  );
}