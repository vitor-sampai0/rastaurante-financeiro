import { NextResponse } from "next/server";
import { z } from "zod";
import { canAdmin } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { refsBelongToRestaurant } from "@/backend/lib/ownership";
import { audit } from "@/backend/lib/audit";
import { decimalToNumber, jsonError, requireApiContext } from "@/backend/lib/http";

const monthNameMap: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

function normalizeReferenceMonth(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const [year, month] = trimmed.split("-");
    if (Number(year) > 0 && Number(month) >= 1 && Number(month) <= 12) return `${year}-${month}`;
    return null;
  }

  if (/^\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [month, year] = trimmed.split("/");
    const monthNumber = Number(month);
    if (monthNumber >= 1 && monthNumber <= 12 && Number(year) > 0) return `${year}-${monthNumber.toString().padStart(2, "0")}`;
    return null;
  }

  const monthMatch = trimmed.toLowerCase().match(/^(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})$/i);
  if (monthMatch) {
    const normalizedMonth = monthNameMap[monthMatch[1].toLowerCase()];
    if (!normalizedMonth) return null;
    return `${monthMatch[2]}-${normalizedMonth}`;
  }

  return null;
}

function formatValidationErrors(issues: z.ZodIssue[]) {
  return issues
    .map((issue) => {
      const fieldName = String(issue.path[0] ?? "campo");
      const labels: Record<string, string> = {
        employeeId: "Funcionário",
        referenceMonth: "Mês de referência",
        grossAmount: "Bruto",
        deductions: "Descontos",
        dueDate: "Vencimento",
      };
      const label = labels[fieldName] ?? "Campo";
      return `${label}: ${issue.message}`;
    })
    .join("\n");
}

const schema = z.object({
  employeeId: z.string().min(1, "Informe um funcionário válido."),
  referenceMonth: z.string().trim().refine((value) => normalizeReferenceMonth(value) !== null, {
    message: "Formato inválido. Use YYYY-MM, MM/YYYY ou o nome do mês com o ano.",
  }),
  grossAmount: z.coerce.number({ message: "Informe um valor numérico." }).positive("Informe um valor maior que zero."),
  deductions: z.coerce.number({ message: "Informe um valor numérico para os descontos." }).nonnegative("Os descontos não podem ser negativos.").default(0),
  dueDate: z.coerce.date({ message: "Data de vencimento inválida." }),
  notes: z.string().max(1000, "Observações muito longas.").nullable().optional(),
}).transform((data) => ({
  ...data,
  referenceMonth: normalizeReferenceMonth(data.referenceMonth) ?? data.referenceMonth,
}));

export async function GET() {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  return NextResponse.json(decimalToNumber(await prisma.payrollEntry.findMany({ where: { restaurantId: auth.ctx.restaurant.id }, include: { employee: true }, orderBy: { dueDate: "desc" } })));
}

export async function POST(request: Request) {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(formatValidationErrors(parsed.error.issues));

  const employee = await prisma.employee.findFirst({
    where: { id: parsed.data.employeeId, restaurantId: auth.ctx.restaurant.id, status: "ACTIVE" },
  });

  if (!employee || !(await refsBelongToRestaurant(auth.ctx.restaurant.id, { employeeId: parsed.data.employeeId }))) {
    return jsonError("Funcionário: não encontrado, inativo ou fora do restaurante autenticado.");
  }

  const row = await prisma.payrollEntry.create({
    data: {
      ...parsed.data,
      grossAmount: parsed.data.grossAmount.toFixed(2),
      deductions: parsed.data.deductions.toFixed(2),
      netAmount: (parsed.data.grossAmount - parsed.data.deductions).toFixed(2),
      restaurantId: auth.ctx.restaurant.id,
    },
  });

  await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "CREATE", entity: "PayrollEntry", entityId: row.id, data: parsed.data });
  return NextResponse.json(decimalToNumber(row), { status: 201 });
}
