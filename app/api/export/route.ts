import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { canAdmin } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { jsonError, requireApiContext } from "@/backend/lib/http";

export async function GET() {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const rows = await prisma.transaction.findMany({ where: { restaurantId: auth.ctx.restaurant.id }, include: { category: true, account: true, creator: { select: { name: true } } }, orderBy: { occurredAt: "asc" } });
  const data = rows.map((row) => ({ Data: row.occurredAt.toLocaleDateString("pt-BR"), Tipo: row.type === "INCOME" ? "Entrada" : "Saída", Descrição: row.description, Categoria: row.category?.name ?? "", Conta: row.account?.name ?? "", Pagamento: row.paymentMethod, Valor: Number(row.amount), Usuário: row.creator.name, Observações: row.notes ?? "" }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Movimentações");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="financeiro-${new Date().toISOString().slice(0, 10)}.xlsx"` } });
}
