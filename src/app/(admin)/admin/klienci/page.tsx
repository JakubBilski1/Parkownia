import { Building2, CircleSlash, ShieldCheck, User, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDatePL, formatParkings } from "@/lib/format";
import { listClients } from "@/modules/admin/clients";
import { getAdminSession } from "@/modules/admin/session";
import { AccessDenied } from "../_components/access-denied";
import { CreateClientDialog } from "../_components/client-forms";
import { PageHeader, TableScroll, Td, Th } from "../_components/layout-parts";

type SearchParams = Promise<{
  q?: string;
  kind?: string;
  usunieci?: string;
  cursor?: string;
}>;

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getAdminSession();
  if (!session) return <AccessDenied />;

  const params = await searchParams;

  const { items, nextCursor } = await listClients({
    ...(params.q ? { q: params.q } : {}),
    ...(params.kind ? { kind: params.kind } : {}),
    includeDeleted: params.usunieci ?? false,
    ...(params.cursor ? { cursor: params.cursor } : {}),
    limit: 25,
  });

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "cursor") query.set(key, value);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Klienci"
        description="Właściciele, z którymi mamy umowę. Konta zakładasz tutaj — samodzielna rejestracja jest wyłączona. Każdemu klientowi możesz dodać konta pracowników do obsługi bramy."
        action={<CreateClientDialog />}
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5 text-ui font-semibold text-ink">
          Nazwa, firma, e-mail lub telefon
          <Input
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Kowalski albo 600100200"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-ui font-semibold text-ink">
          Typ
          <Select name="kind" defaultValue={params.kind ?? ""}>
            <option value="">Wszyscy</option>
            <option value="BUSINESS">Firmy</option>
            <option value="INDIVIDUAL">Osoby prywatne</option>
          </Select>
        </label>

        <div className="pb-2">
          <Checkbox name="usunieci" defaultChecked={Boolean(params.usunieci)} label="Pokaż usuniętych" />
        </div>

        <Button type="submit" variant="quiet">
          Filtruj
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nie ma tu jeszcze żadnego klienta"
          description="Zadzwoń do kogoś z listy leadów, a potem załóż mu konto przyciskiem „Dodaj klienta”. Hasło tymczasowe pokażemy raz — przekaż je przez telefon."
        />
      ) : (
        <TableScroll>
          <thead>
            <tr>
              <Th>Klient</Th>
              <Th>Kontakt</Th>
              <Th>Typ</Th>
              <Th className="text-right">Parkingi</Th>
              <Th className="text-right">Pracownicy</Th>
              <Th>Wypłaty</Th>
              <Th>Od kiedy</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((client) => {
              // `||`, not `??`: an empty join is "" and a client with no name at
              // all has to fall through to the e-mail, which is never blank.
              const name =
                client.companyName ||
                [client.firstName, client.lastName].filter(Boolean).join(" ") ||
                client.email;

              return (
                <tr key={client.id}>
                  <Td>
                    <Link
                      href={`/admin/klienci/${client.id}`}
                      className="font-semibold text-ink underline underline-offset-4"
                    >
                      {name}
                    </Link>
                    {client.deletedAt ? (
                      <>
                        <br />
                        <Badge icon={CircleSlash} tone="muted">
                          Usunięty {formatDatePL(client.deletedAt)}
                        </Badge>
                      </>
                    ) : null}
                  </Td>

                  <Td className="text-muted">
                    {client.deletedAt ? (
                      <span>dane nadpisane</span>
                    ) : (
                      <>
                        <a
                          href={`mailto:${client.email}`}
                          className="text-ink underline underline-offset-4"
                        >
                          {client.email}
                        </a>
                        {client.phone ? (
                          <>
                            <br />
                            <a
                              href={`tel:${client.phone.replace(/\s/g, "")}`}
                              className="num text-ink underline underline-offset-4"
                            >
                              {client.phone}
                            </a>
                          </>
                        ) : null}
                      </>
                    )}
                  </Td>

                  <Td>
                    <Badge icon={client.isBusiness ? Building2 : User} tone="neutral">
                      {client.isBusiness ? "Firma · 30%" : "Osoba · 50%"}
                    </Badge>
                    {client.nip ? (
                      <>
                        <br />
                        <span className="num text-ui text-muted">NIP {client.nip}</span>
                      </>
                    ) : null}
                  </Td>

                  <Td className="num text-right text-ink">{client.parkingCount}</Td>
                  <Td className="num text-right text-ink">{client.employeeCount}</Td>

                  <Td>
                    {/* Stripe's answer, never ours: without payouts_enabled a parking
                        cannot go on sale, because we could not pay the host. */}
                    <Badge
                      icon={client.payoutsEnabled ? ShieldCheck : CircleSlash}
                      tone={client.payoutsEnabled ? "ok" : "muted"}
                    >
                      {client.payoutsEnabled ? "Gotowe" : "Brak weryfikacji"}
                    </Badge>
                  </Td>

                  <Td className="num whitespace-nowrap text-muted">
                    {formatDatePL(client.createdAt)}
                    {client.parkingCount > 0 ? (
                      <>
                        <br />
                        <span className="text-ui text-muted">
                          {formatParkings(client.parkingCount)}
                        </span>
                      </>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableScroll>
      )}

      {nextCursor ? (
        <Link
          href={`/admin/klienci?${query.toString()}${query.size > 0 ? "&" : ""}cursor=${nextCursor}`}
          className="inline-flex min-h-touch w-fit items-center rounded-button border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-micro ease-out hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Następne 25
        </Link>
      ) : null}
    </div>
  );
}
