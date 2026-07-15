# pbdevs mail templates — shared layout & building blocks

These are the MJML + Handlebars sources for the Parkownia transactional e-mails.
Paste each `<name>.mjml` into the matching template in the pbdevs dashboard
(app: Parkownia), set the **subject** listed in `README.md`, and the app will render
them by POSTing `{ template: "<name>", to, data }` to the mail API.

The app never sends HTML — it sends the variables below. Every value arrives
**display-ready**: dates are already `25.07.2026, 20:00` (Europe/Warsaw), money is
already `35 zł`. Do not reformat in the template.

## Design tokens (light "Bilet" palette — inbox clients invert dark mode themselves)

| token | hex | use |
|---|---|---|
| bg | `#EEEEEB` | page background |
| surface | `#FFFFFF` | card |
| surface2 | `#F3F3F0` | panel |
| ink | `#191A1C` | text |
| muted | `#70747A` | secondary text |
| line | `#DEDEDA` | borders |
| accent | `#8E2B2B` | the single button |
| accentInk | `#FFFFFF` | button text |

Fonts (stacks, no web-font loading — system fallback):
- display: `Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif`
- body: `'IBM Plex Sans', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`
- mono: `'IBM Plex Mono', ui-monospace, SFMono-Regular, Consolas, monospace`

## Skeleton (identical in every template)

```mjml
<mjml>
  <mj-head>
    <mj-title>Parkownia</mj-title>
    <mj-preview>{{! per-template preview text }}</mj-preview>
    <mj-attributes>
      <mj-all font-family="'IBM Plex Sans', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" />
      <mj-text color="#191A1C" font-size="16px" line-height="24px" padding="0 0 16px" />
    </mj-attributes>
    <mj-style>
      .muted div { color:#70747A !important; font-size:14px !important; line-height:20px !important; }
      .mono div  { font-family:'IBM Plex Mono', ui-monospace, SFMono-Regular, Consolas, monospace !important; }
      a { color:#8E2B2B; }
    </mj-style>
  </mj-head>
  <mj-body background-color="#EEEEEB" width="560px">
    <mj-wrapper background-color="#FFFFFF" border="1px solid #DEDEDA" border-radius="14px" padding="32px 28px">
      <mj-section padding="0">
        <mj-column>
          <mj-text font-family="Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="18px" font-weight="800" letter-spacing="-0.01em" padding="0 0 24px">Parkownia</mj-text>
          <mj-text font-family="Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="28px" font-weight="700" line-height="34px" letter-spacing="-0.02em" padding="0 0 16px">{{! per-template heading }}</mj-text>
        </mj-column>
      </mj-section>

      {{! ===== BODY: the per-template content sections go here ===== }}

      <mj-section padding="0">
        <mj-column>
          <mj-divider border-color="#DEDEDA" border-width="1px" padding="28px 0 20px" />
          <mj-text css-class="muted" padding="0 0 6px">{{! per-template footer note }}</mj-text>
          <mj-text css-class="muted" padding="0"><a href="https://parkownia.com/konto" style="color:#70747A;">Ustawienia powiadomień</a></mj-text>
        </mj-column>
      </mj-section>
    </mj-wrapper>
  </mj-body>
</mjml>
```

## Building blocks (use inside the BODY, in a `<mj-column>`)

**Paragraph**
```mjml
<mj-text padding="0 0 16px">…</mj-text>
```

**Muted note**
```mjml
<mj-text css-class="muted" padding="0 0 16px">…</mj-text>
```

**Detail row** (label above value; reads fine with CSS stripped)
```mjml
<mj-text css-class="muted" padding="0 0 2px">Parking</mj-text>
<mj-text padding="0 0 14px">{{parkingTitle}}</mj-text>
```
Monospace value (dates, money): add `css-class="mono"` to the value line.

**Panel** (the one grey box) — a nested section inside the wrapper:
```mjml
<mj-section background-color="#F3F3F0" border="1px solid #DEDEDA" border-radius="14px" padding="20px">
  <mj-column>
    …
  </mj-column>
</mj-section>
```

**Button** (the single accented element — at most one per e-mail):
```mjml
<mj-section padding="0">
  <mj-column>
    <mj-button href="{{ctaUrl}}" background-color="#8E2B2B" color="#FFFFFF" border-radius="12px" font-size="16px" font-weight="600" align="left" inner-padding="12px 24px" padding="8px 0 24px">{{ctaLabel}}</mj-button>
  </mj-column>
</mj-section>
```

**Secondary link**
```mjml
<mj-text padding="0 0 20px"><a href="{{bookingUrl}}" style="color:#191A1C;text-decoration:underline;">Rezerwacja, kod QR i anulowanie</a></mj-text>
```

## Handlebars

pbdevs renders Handlebars first, then MJML. Use only `{{var}}` and `{{#if var}}…{{/if}}`
(optionally `{{else}}`) — the app resolves every enum into a boolean or a ready
sentence, so no comparison helpers are needed. `{{#if firstName}}` is the standard
way the greeting branches; an absent name arrives as an empty string.
