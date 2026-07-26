import { FAQ_ITEMS } from "./faq";

/**
 * Structured data: Organization + FAQPage. The FAQ entries come from the same
 * FAQ_ITEMS the page renders, so the two never drift.
 */
export function JsonLd() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Parkownia",
    url: "https://parkownia.com",
    email: "kontakt@parkownia.com",
    description: "Marketplace parkingowy w Poznaniu — rezerwacja miejsc na mecze i targi.",
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Server-rendered constant JSON; no user input in it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
      />
    </>
  );
}
