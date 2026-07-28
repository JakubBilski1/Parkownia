/**
 * Who stands behind this service, stated once, at the top, in both documents.
 *
 * These details used to be printed in the site footer on every page. They are
 * not there any more — a home address does not belong on every screen and in
 * every crawler's index — so the two places the law points at have to carry
 * them plainly rather than three paragraphs down: RODO art. 13 ust. 1 lit. a
 * (identity and contact details of the controller) and UŚUDE art. 5 ust. 2
 * (the provider's name, address and e-mail).
 */
export function EntityCard({ role }: { role: "controller" | "provider" }) {
  return (
    <dl className="mt-6 grid gap-x-6 gap-y-2 rounded-card border border-line bg-surface p-5 text-body sm:grid-cols-[auto_1fr]">
      <dt className="text-ui text-muted">
        {role === "controller" ? "Administrator danych" : "Usługodawca"}
      </dt>
      <dd className="font-semibold text-ink">Jakub Bilski (osoba fizyczna)</dd>

      <dt className="text-ui text-muted">Adres do doręczeń</dt>
      <dd className="text-ink">ul. Krótka 10a, Mosina</dd>

      <dt className="text-ui text-muted">Kontakt</dt>
      <dd>
        <a
          href="mailto:kontakt@parkownia.com"
          className="text-ink underline underline-offset-4"
        >
          kontakt@parkownia.com
        </a>
      </dd>
    </dl>
  );
}
