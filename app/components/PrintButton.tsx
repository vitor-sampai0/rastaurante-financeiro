"use client";

export default function PrintButton() {
  return (
    <button
      className="primary-button compact"
      type="button"
      onClick={() => window.print()}
    >
      Imprimir fechamento
    </button>
  );
}
