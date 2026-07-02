import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
  lineHeight?: number;
  style?: CSSProperties;
}

const toolbarBtnStyle: CSSProperties = {
  padding: "4px 10px",
  border: "1px solid #d6dbe7",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  color: "#475467",
  lineHeight: 1.4,
  transition: "all .12s ease",
};

const activeBtnStyle: CSSProperties = {
  ...toolbarBtnStyle,
  background: "#1f3b73",
  color: "#fff",
  borderColor: "#1f3b73",
};

export function RichTextEditor({ value, onChange, minHeight = 180, lineHeight = 1.8, style }: RichTextEditorProps) {
  const internalChange = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        listItem: false,
        bulletList: false,
        orderedList: false,
      }),
      Underline,
    ],
    content: value || "",
    onUpdate: ({ editor: e }) => {
      internalChange.current = true;
      onChange(e.getHTML());
    },
  });

  useEffect(() => {
    if (editor && !internalChange.current) {
      editor.commands.setContent(value || "");
    }
    internalChange.current = false;
  }, [value]);

  if (!editor) return null;

  return (
    <div style={{ border: "1px solid #d6dbe7", borderRadius: 10, overflow: "hidden", ...style }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 4, padding: "8px 10px",
        borderBottom: "1px solid #e4e7ec", background: "#fafbfc", flexWrap: "wrap",
      }}>
        <button
          type="button"
          style={editor.isActive("bold") ? activeBtnStyle : toolbarBtnStyle}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrito"
        >
          <strong>N</strong>
        </button>
        <button
          type="button"
          style={editor.isActive("italic") ? activeBtnStyle : toolbarBtnStyle}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Itálico"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          style={editor.isActive("underline") ? activeBtnStyle : toolbarBtnStyle}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Sublinhado"
        >
          <span style={{ textDecoration: "underline" }}>S</span>
        </button>
      </div>

      <EditorContent
        editor={editor}
        style={{
          minHeight,
          padding: "12px 14px",
          fontSize: 14,
          color: "#1a1d2e",
          background: "#fff",
          cursor: "text",
        }}
      />

      <style>{`
        .tiptap { outline: none; min-height: ${minHeight}px; line-height: ${lineHeight}; }
        .tiptap p { margin: 0 0 8px 0; }
        .tiptap p:last-child { margin-bottom: 0; }
      `}</style>
    </div>
  );
}

export function isHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

export function plainTextToHtml(text: string): string {
  if (!text) return "";
  if (isHtml(text)) return text;
  return text.split("\n").filter(Boolean).map(p => `<p>${p}</p>`).join("");
}
