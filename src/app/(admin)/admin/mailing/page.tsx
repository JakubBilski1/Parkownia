import { AlertTriangle, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTimePL } from "@/lib/format";
import { MAX_RECIPIENTS, listCampaigns } from "@/modules/admin/campaigns";
import { getAdminSession } from "@/modules/admin/session";
import { AccessDenied } from "../_components/access-denied";
import { CampaignComposer } from "../_components/campaign-composer";
import { PageHeader, Section, TableScroll, Td, Th } from "../_components/layout-parts";

export const dynamic = "force-dynamic";

export default async function MailingPage() {
  const session = await getAdminSession();
  if (!session) return <AccessDenied />;

  const campaigns = await listCampaigns(20);
  const provider = process.env.EMAIL_PROVIDER ?? "console";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Mailing"
        description="Jedna wiadomość, lista adresów, jeden przycisk. Treść i lista każdej wysyłki zostają zapisane — po skardze pierwsze pytanie brzmi „co dokładnie do nich napisaliśmy”."
      />

      {provider !== "pbdevs" ? (
        <div className="flex items-start gap-3 rounded-card border border-line bg-surface-2 p-4">
          <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
          <div>
            <p className="text-body font-semibold text-ink">
              Poczta jest w trybie „{provider}” — nic nie wyjdzie na zewnątrz.
            </p>
            <p className="text-ui text-muted">
              Wysyłka zadziała i zapisze historię, ale treść wyląduje w logu kontenera zamiast w
              skrzynkach. Ustaw <code className="font-mono">EMAIL_PROVIDER=pbdevs</code> i{" "}
              <code className="font-mono">MAIL_API_KEY</code>, a w panelu pocztowym dodaj szablon{" "}
              <code className="font-mono">owner-campaign</code> (źródło:{" "}
              <code className="font-mono">docs/mail-templates/owner-campaign.mjml</code>, temat
              ustaw na <code className="font-mono">{"{{subject}}"}</code>).
            </p>
          </div>
        </div>
      ) : null}

      <CampaignComposer maxRecipients={MAX_RECIPIENTS} />

      <Section title="Historia wysyłek" hint="Ostatnie 20 kampanii.">
        {campaigns.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="Nic jeszcze nie wysłałeś"
            description="Pierwsza kampania pojawi się tutaj razem z liczbą adresatów i tym, ile maili doszło."
          />
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Kiedy</Th>
                <Th>Temat</Th>
                <Th className="text-right">Adresatów</Th>
                <Th className="text-right">Wysłane</Th>
                <Th className="text-right">Nieudane</Th>
                <Th>Zgody</Th>
                <Th>Kto</Th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <Td className="num whitespace-nowrap text-muted">
                    {formatDateTimePL(campaign.createdAt)}
                  </Td>
                  <Td className="text-ink">
                    {campaign.subject}
                    <br />
                    <span className="text-ui text-muted">{campaign.heading}</span>
                  </Td>
                  <Td className="num text-right text-ink">{campaign.recipientCount}</Td>
                  <Td className="num text-right text-ink">{campaign.sentCount}</Td>
                  <Td className="num text-right">
                    {campaign.failedCount > 0 ? (
                      <span className="text-danger">{campaign.failedCount}</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </Td>
                  <Td>
                    {campaign.consentOverride ? (
                      <Badge icon={AlertTriangle} tone="bad">
                        Na oświadczenie
                      </Badge>
                    ) : (
                      <Badge icon={Mail} tone="ok">
                        Tylko ze zgodą
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-muted">{campaign.authorEmail ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </Section>
    </div>
  );
}
