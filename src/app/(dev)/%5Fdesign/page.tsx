"use client";

/**
 * DEV SANDBOX — DELETE BEFORE PRODUCTION.
 * Visual check of every primitive in both themes. Not linked from anywhere,
 * carries no domain logic, and must not survive Faza 5 (hardening).
 */

import {
  Ban,
  Car,
  CheckCircle2,
  Clock,
  Ruler,
  Umbrella,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardMeta,
  CardTitle,
  Checkbox,
  Chip,
  Dialog,
  EmptyState,
  Field,
  Input,
  Price,
  Progress,
  RadioGroup,
  Select,
  Sheet,
  SkeletonList,
  Switch,
  Textarea,
  Ticket,
  TicketCode,
  TicketMain,
  TicketStub,
  useToast,
} from "@/components/ui";
import { formatDateTimePL, formatWalkDistance, formatWalkTime } from "@/lib/format";

const EVENT_START = new Date("2026-07-25T18:00:00Z");

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-h3 font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSandboxPage() {
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [covered, setCovered] = useState(true);
  const [ev, setEv] = useState(false);
  const [access, setAccess] = useState<"gate" | "barrier" | "open">("barrier");

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 p-4 pb-24">
      <header className="flex items-center justify-between gap-4 pt-4">
        <div>
          <h1 className="font-display text-h1">System designu</h1>
          <p className="text-ui text-muted">
            Piaskownica deweloperska. Usunąć przed produkcją.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Przyciski">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="accent" size="lg">
            Zarezerwuj miejsce
          </Button>
          <Button variant="quiet">Pokaż na mapie</Button>
          <Button variant="ghost">Więcej filtrów</Button>
          <Button variant="danger">Anuluj rezerwację</Button>
          <Button variant="accent" loading>
            Płacę
          </Button>
          <Button variant="quiet" disabled>
            Niedostępny
          </Button>
        </div>
      </Section>

      <Section title="Filtry (stan włączony jest neutralny)">
        <div className="flex flex-wrap gap-2">
          <Chip icon={Umbrella} selected={covered} onClick={() => setCovered((v) => !v)}>
            Zadaszony
          </Chip>
          <Chip icon={Zap} selected={ev} onClick={() => setEv((v) => !v)} count={4}>
            Ładowarka
          </Chip>
          <Chip icon={Ruler}>Wysokość 2,1 m</Chip>
          <Chip icon={Car} count={17}>
            Do 500 m
          </Chip>
        </div>
      </Section>

      <Section title="Cena i status">
        <Card>
          <CardHeader>
            <CardTitle>Parking Enea Stadion, ul. Bułgarska</CardTitle>
            <CardMeta>
              {formatWalkDistance(620)} · {formatWalkTime(620)}
            </CardMeta>
          </CardHeader>
          <CardBody className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <Price gr={3500} per="za mecz" size="lg" />
              <div className="flex flex-wrap gap-2">
                <Badge tone="ok" icon={CheckCircle2}>
                  Ważna
                </Badge>
                <Badge tone="muted" icon={Clock}>
                  Zużyta
                </Badge>
                <Badge tone="bad" icon={Ban}>
                  Anulowana
                </Badge>
              </div>
            </div>
            <Button variant="accent">Zarezerwuj</Button>
          </CardBody>
        </Card>
      </Section>

      <Section title="Bilet (element sygnaturowy)">
        <Ticket className="max-w-sm">
          <TicketMain className="flex flex-col gap-1">
            <span className="text-ui text-muted">Lech Poznań — Cracovia</span>
            <span className="font-display text-h3 font-bold">
              Bułgarska 5/7, poziom -1
            </span>
            <span className="num text-ui text-muted">
              {formatDateTimePL(EVENT_START)}
            </span>
          </TicketMain>
          <TicketStub className="flex items-end justify-between gap-4">
            <TicketCode code="PK-7H2K" />
            <Price gr={3500} size="md" />
          </TicketStub>
        </Ticket>
      </Section>

      <Section title="Formularz">
        <div className="flex flex-col gap-4">
          <Field label="E-mail" hint="Wyślemy tam kod wjazdu." required>
            {(props) => (
              <Input
                {...props}
                type="email"
                autoComplete="email"
                placeholder="jan@przyklad.pl"
              />
            )}
          </Field>

          <Field
            label="Wysokość auta"
            error="Podaj wysokość — parking podziemny ma 1,9 m i nie wpuści SUV-a."
            required
          >
            {(props) => (
              <Input {...props} type="number" inputMode="numeric" suffix="cm" />
            )}
          </Field>

          <Field label="Liczba miejsc" required>
            {(props) => (
              <Select {...props} defaultValue="10">
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </Select>
            )}
          </Field>

          <Field label="Dojazd do wjazdu">
            {(props) => (
              <Textarea {...props} placeholder="Wjazd od ul. Górczyńskiej, za szlabanem." />
            )}
          </Field>

          <RadioGroup
            name="access"
            legend="Wjazd"
            value={access}
            onValueChange={setAccess}
            options={[
              { value: "gate", label: "Brama otwierana przez hosta" },
              { value: "barrier", label: "Szlaban otwierany na kod", hint: "Kod z rezerwacji." },
              { value: "open", label: "Wjazd otwarty" },
            ]}
          />

          <Checkbox label="Akceptuję regulamin" hint="Wymagane do rezerwacji." />
          <Switch label="Udostępniam parking na ten mecz" hint="Możesz to cofnąć do 24 h przed." />
          <Progress value={60} label="Dodawanie parkingu" hint="3 z 5" />
        </div>
      </Section>

      <Section title="Warstwy">
        <div className="flex flex-wrap gap-2">
          <Button variant="quiet" onClick={() => setSheetOpen(true)}>
            Otwórz panel
          </Button>
          <Button variant="quiet" onClick={() => setDialogOpen(true)}>
            Otwórz dialog
          </Button>
          <Button
            variant="quiet"
            onClick={() =>
              toast({ tone: "ok", message: "Zarezerwowano. Kod: PK-7H2K." })
            }
          >
            Toast sukcesu
          </Button>
          <Button
            variant="quiet"
            onClick={() =>
              toast({
                tone: "error",
                message: "Płatność nie przeszła.",
                detail: "Środki nie zostały pobrane. Spróbuj ponownie albo zapłać BLIK-iem.",
              })
            }
          >
            Toast błędu
          </Button>
        </div>
      </Section>

      <Section title="Ładowanie i stan pusty">
        <SkeletonList count={2} />
        <EmptyState
          icon={Car}
          title="Nie mamy jeszcze parkingów przy tym wydarzeniu"
          description="Masz miejsce w okolicy? Udostępnij je na ten mecz i zarób. Wystawienie zajmuje 3 minuty."
          action={<Button variant="accent">Udostępnij swoje miejsce</Button>}
        />
      </Section>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Parking przy Bułgarskiej"
        footer={
          <Button variant="accent" size="lg" block>
            Zarezerwuj za 35 zł
          </Button>
        }
      >
        <p className="text-body text-muted">
          Wjazd od ul. Górczyńskiej. Szlaban otwierany na kod z rezerwacji.
        </p>
      </Sheet>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Anulować rezerwację?"
        description="Zwrócimy 35 zł na tę samą kartę w ciągu 3 dni roboczych. Miejsce wróci do sprzedaży."
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Zostawiam rezerwację
            </Button>
            <Button variant="danger" onClick={() => setDialogOpen(false)}>
              Anuluję i przyjmuję zwrot
            </Button>
          </>
        }
      />
    </main>
  );
}
