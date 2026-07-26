import { ArrowLeft, Building2, QrCode, ShieldCheck, CircleSlash, User } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDatePL, formatDateTimePL } from "@/lib/format";
import { getClient } from "@/modules/admin/clients";
import { getAdminSession } from "@/modules/admin/session";
import { AccessDenied } from "../../_components/access-denied";
import {
  ClientEditForm,
  CreateEmployeeDialog,
  DeleteClientButton,
  DeleteEmployeeButton,
  ResetPasswordButton,
} from "../../_components/client-forms";
import { PageHeader, Section, TableScroll, Td, Th } from "../../_components/layout-parts";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return <AccessDenied />;

  const { id } = await params;
  const client = await getClient({ clientId: id });

  const name =
    client.companyName || [client.firstName, client.lastName].filter(Boolean).join(" ") || client.email;
  const deleted = client.deletedAt !== null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/klienci"
          className="inline-flex min-h-touch items-center gap-1.5 text-ui text-muted hover:text-ink"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Wszyscy klienci
        </Link>
      </div>

      <PageHeader
        title={name}
        description={
          deleted
            ? "Ten klient został usunięty. Dane osobowe są nadpisane, konta wyłączone, parkingi wstrzymane. Rezerwacje i płatności zostały — wymaga tego księgowość."
            : "Dane klienta, jego konta pracownicze i hasła. Wszystko, czym obsługujesz go przez telefon."
        }
        action={deleted ? undefined : <DeleteClientButton clientId={client.id} label={name} />}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge icon={client.isBusiness ? Building2 : User} tone="neutral">
          {client.isBusiness ? "Firma · prowizja 30%" : "Osoba prywatna · prowizja 50%"}
        </Badge>
        <Badge
          icon={client.payoutsEnabled ? ShieldCheck : CircleSlash}
          tone={client.payoutsEnabled ? "ok" : "muted"}
        >
          {client.payoutsEnabled ? "Wypłaty gotowe" : "Wypłaty niezweryfikowane"}
        </Badge>
        {client.nip ? (
          <span className="num text-ui text-muted">NIP {client.nip}</span>
        ) : null}
        <span className="num text-ui text-muted">Klient od {formatDatePL(client.createdAt)}</span>
      </div>

      {deleted ? null : (
        <>
          <Section title="Dane i logowanie" hint="E-maila nie zmieniamy — to login tego konta.">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,32rem)_minmax(0,20rem)]">
              <div className="rounded-card border border-line bg-surface p-4 shadow-card">
                <ClientEditForm
                  clientId={client.id}
                  firstName={client.firstName}
                  lastName={client.lastName}
                  phone={client.phone}
                  companyName={client.companyName}
                  address={null}
                  isBusiness={client.isBusiness}
                />
              </div>

              <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
                <div>
                  <p className="text-ui font-semibold text-ink">Login</p>
                  <p className="text-body text-muted">{client.email}</p>
                </div>
                <p className="text-ui text-muted">
                  Klient nie pamięta hasła? Wygeneruj nowe — stare przestanie działać, a wszystkie
                  jego sesje zostaną zamknięte.
                </p>
                <ResetPasswordButton accountId={client.id} clientId={client.id} label={name} />
              </div>
            </div>
          </Section>

          <Section
            title="Pracownicy"
            hint="Konto pracownika widzi skaner i listę rezerwacji tego klienta. Nie widzi cen, wypłat ani formularza parkingu."
          >
            <div className="flex flex-col gap-4">
              <CreateEmployeeDialog clientId={client.id} />

              {client.employees.length === 0 ? (
                <EmptyState
                  icon={QrCode}
                  title="Ten klient nie ma jeszcze pracowników"
                  description="Jeśli przy bramie stoi ktoś inny niż właściciel, załóż mu osobne konto. Nie przekazujcie sobie jednego hasła — po zwolnieniu pracownika wyłączasz tylko jego dostęp."
                />
              ) : (
                <TableScroll>
                  <thead>
                    <tr>
                      <Th>Pracownik</Th>
                      <Th>Login</Th>
                      <Th>Dodany</Th>
                      <Th className="text-right">Hasło</Th>
                      <Th className="text-right">Dostęp</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.employees.map((employee) => {
                      const employeeName =
                        [employee.firstName, employee.lastName].filter(Boolean).join(" ") ||
                        employee.email;

                      return (
                        <tr key={employee.id}>
                          <Td className="text-ink">
                            {employeeName}
                            {employee.phone ? (
                              <>
                                <br />
                                <a
                                  href={`tel:${employee.phone.replace(/\s/g, "")}`}
                                  className="num text-ui text-muted underline underline-offset-4"
                                >
                                  {employee.phone}
                                </a>
                              </>
                            ) : null}
                          </Td>
                          <Td className="text-muted">{employee.email}</Td>
                          <Td className="num whitespace-nowrap text-muted">
                            {formatDateTimePL(employee.createdAt)}
                          </Td>
                          <Td className="text-right">
                            <div className="flex justify-end">
                              <ResetPasswordButton
                                accountId={employee.id}
                                clientId={client.id}
                                label={employeeName}
                              />
                            </div>
                          </Td>
                          <Td className="text-right">
                            <div className="flex justify-end">
                              <DeleteEmployeeButton
                                employeeId={employee.id}
                                clientId={client.id}
                                label={employeeName}
                              />
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </TableScroll>
              )}
            </div>
          </Section>
        </>
      )}

      <Section title="Parkingi" hint="Zatwierdzasz je w moderacji — tutaj tylko liczba.">
        <p className="text-body text-muted">
          {client.parkingCount === 0
            ? "Ten klient nie wystawił jeszcze żadnego parkingu."
            : `Parkingi tego klienta: ${client.parkingCount}. Otwórz moderację, żeby je przejrzeć.`}
        </p>
      </Section>
    </div>
  );
}
