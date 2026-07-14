import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTimePL } from "@/lib/format";
import { listCommissionRules } from "@/modules/admin/commissions";
import { COMMISSION_SCOPE_LABEL } from "@/modules/admin/labels";
import { getAdminSession } from "@/modules/admin/session";
import { AccessDenied } from "../_components/access-denied";
import {
  DeleteOverrideButton,
  GlobalRateForm,
  OverrideForm,
} from "../_components/commission-forms";
import { PageHeader, Section, TableScroll, Td, Th } from "../_components/layout-parts";

export default async function CommissionsPage() {
  const session = await getAdminSession();
  if (!session) return <AccessDenied />;

  const { globals, overrides, superseded } = await listCommissionRules();

  const rateOf = (scope: "GLOBAL_INDIVIDUAL" | "GLOBAL_BUSINESS") =>
    globals.find((rule) => rule.scope === scope)?.ratePct ?? null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Prowizje"
        description="Stawka obowiązująca w chwili rezerwacji jest w niej zamrożona. Zmiana tutaj nie rusza sprzedanych już rezerwacji."
      />

      <Section
        title="Stawki globalne"
        hint="Obowiązują wszędzie tam, gdzie nie ma nadpisania dla hosta lub parkingu."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <GlobalRateForm
            scope="GLOBAL_INDIVIDUAL"
            label="Osoby prywatne"
            currentRate={rateOf("GLOBAL_INDIVIDUAL")}
          />
          <GlobalRateForm
            scope="GLOBAL_BUSINESS"
            label="Firmy"
            currentRate={rateOf("GLOBAL_BUSINESS")}
          />
        </div>
      </Section>

      <Section
        title="Nadpisania"
        hint="Pierwszeństwo: parking przed hostem, host przed stawką globalną."
      >
        <OverrideForm />

        {overrides.length === 0 ? (
          <EmptyState
            title="Nie ma żadnych nadpisań"
            description="Wszyscy hostowie rozliczają się stawką globalną. Nadpisanie przydaje się przy negocjacjach z operatorem, który przyprowadza dużą podaż."
          />
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Zakres</Th>
                <Th>Kogo dotyczy</Th>
                <Th className="text-right">Stawka</Th>
                <Th>Obowiązuje od</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {overrides.map((rule) => (
                <tr key={rule.id}>
                  <Td className="text-ink">{COMMISSION_SCOPE_LABEL[rule.scope]}</Td>
                  <Td className="text-muted">
                    {rule.targetLabel ?? "—"}
                    <br />
                    <span className="font-mono text-ui text-muted">
                      {rule.userId ?? rule.parkingId}
                    </span>
                  </Td>
                  <Td className="num text-right font-semibold text-ink">{rule.ratePct}%</Td>
                  <Td className="num text-muted">{formatDateTimePL(rule.validFrom)}</Td>
                  <Td className="text-right">
                    <DeleteOverrideButton ruleId={rule.id} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </Section>

      {superseded.length > 0 ? (
        <Section
          title="Historia zmian"
          hint="Poprzednie wersje stawek. Zostają, żeby dało się wyjaśnić stare rozliczenie."
        >
          <TableScroll>
            <thead>
              <tr>
                <Th>Zakres</Th>
                <Th>Kogo dotyczyła</Th>
                <Th className="text-right">Stawka</Th>
                <Th>Obowiązywała od</Th>
              </tr>
            </thead>
            <tbody>
              {superseded.map((rule) => (
                <tr key={rule.id}>
                  <Td className="text-muted">{COMMISSION_SCOPE_LABEL[rule.scope]}</Td>
                  <Td className="text-muted">{rule.targetLabel ?? "wszyscy"}</Td>
                  <Td className="num text-right text-muted">{rule.ratePct}%</Td>
                  <Td className="num text-muted">{formatDateTimePL(rule.validFrom)}</Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        </Section>
      ) : null}
    </div>
  );
}
