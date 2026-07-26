# Enquiry form → n8n → WhatsApp

The contact form POSTs the enquiry to an n8n webhook. n8n sends it on to
Guruji's WhatsApp as a template message. Delivery no longer depends on the
visitor pressing Send.

```
vedajyothi.vercel.app/contact.html
        │  POST JSON
        ▼
n8n webhook  ──► validate + flatten ──► Meta Graph API ──► WhatsApp 9032644115
        │                                                        
        └─ webhook unreachable? the page falls back to opening wa.me,
           so an enquiry is never silently lost
```

---

## Why a template, and not just a text message

Meta only allows **free-form** WhatsApp messages inside a 24-hour window that
opens when *the recipient* messages the business number. Here the business is
messaging first, every time — so it must be a **pre-approved template**. There is
no way around this on the official API; see
[n8n's WhatsApp docs](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.whatsapp).

The sending number must also be registered with the WhatsApp Business API, and
such a number **cannot also be used in the normal WhatsApp app**. That is why we
use Meta's free *test* number to send: Guruji's 9032644115 stays exactly as it
is and only ever receives.

---

## Step 1 — Meta WhatsApp setup (free, ~20 minutes)

1. Go to [developers.facebook.com](https://developers.facebook.com/) → **My Apps**
   → **Create App** → type **Business**.
2. In the app, add the **WhatsApp** product. Meta assigns a free **test phone
   number** — this is the sender. You do not need a SIM.
3. Open **WhatsApp → API Setup** and note:
   - **Phone number ID** — a long number, *not* the phone number itself
   - **Temporary access token** — valid 24 hours, fine for a first test
4. Under **To**, click **Manage phone number list** and add **+91 9032644115**.
   Guruji must accept the confirmation code sent to that number.
   *The test number can only message numbers on this list — up to 5. That is
   ample here, since it only ever messages Guruji.*
5. Go to **WhatsApp → Message Templates → Create template**:

   | Field | Value |
   | --- | --- |
   | Name | `vedajyothi_enquiry` |
   | Category | **Utility** |
   | Language | **English** |

   Body — paste exactly this, with five variables:

   ```
   New enquiry from Veda Jyothi Pathashala.

   Name: {{1}}
   Phone: {{2}}
   Place: {{3}}
   Subject: {{4}}
   Message: {{5}}
   ```

   Provide sample values when asked, then submit. Utility templates are usually
   approved within minutes.

6. **Make the token permanent.** The 24-hour token will expire and silently break
   delivery. In **Business Settings → Users → System Users**, create a system
   user, give it access to the app, and generate a token with the
   `whatsapp_business_messaging` permission and **no expiry**.

> **Rate limit:** Meta's test number is capped at a modest number of
> business-initiated messages per day. Fine for enquiries; if the pathashala ever
> outgrows it, register a real business number.

---

## Step 2 — Run n8n

n8n Cloud has only a 14-day trial, so for something meant to run indefinitely,
self-hosting is the cheaper answer. Any small VPS (~$5/month — Hetzner,
DigitalOcean) is more than enough.

**n8n must be reachable over public HTTPS.** The POST comes from the visitor's
browser, so a laptop or a `localhost` instance will not work.

```bash
# on the server
git clone https://github.com/grksharma/veda-jyothi-pathashala.git
cd veda-jyothi-pathashala/n8n

cp .env.example .env
nano .env            # fill in N8N_HOST, password, VJP_WA_PHONE_NUMBER_ID
nano Caddyfile       # replace n8n.example.com with the same subdomain

docker compose up -d
```

Point an `A` record for that subdomain at the server's IP **before** starting —
Caddy fetches the TLS certificate on first run. Then open
`https://your-subdomain/` and create the owner account.

---

## Step 3 — Import the workflow

1. In n8n: **Workflows → Import from File** → `vedajyothi-enquiry.workflow.json`
2. **Credentials → New → Header Auth**, named exactly **`Meta WhatsApp token`**:
   - Name: `Authorization`
   - Value: `Bearer EAAG...` ← the permanent token from step 1.6
3. Open the **Send WhatsApp template** node and re-select that credential
   (the imported file cannot carry a credential ID).
4. **Activate** the workflow — the Production URL only exists while it is active.
5. Copy the webhook **Production URL** from the *Website form* node. It looks like
   `https://your-subdomain/webhook/vedajyothi-enquiry`.

---

## Step 4 — Point the site at it

Edit [`assets/js/config.js`](../assets/js/config.js):

```js
n8nWebhook: "https://your-subdomain/webhook/vedajyothi-enquiry",
```

Commit and push — Vercel redeploys automatically. Submit the form once and check
that the message arrives.

---

## CORS — the thing that usually breaks first

The browser sends a preflight `OPTIONS` before the POST, because the request is
cross-origin and carries `Content-Type: application/json`. The webhook node is
already configured with:

```
Allowed Origins (CORS): https://vedajyothi.vercel.app
```

If the form silently falls back to WhatsApp and the browser console shows a CORS
error, this is why. Check the value matches the live origin **exactly** — no
trailing slash, and `https` not `http`. Add `http://localhost:4321` alongside it
if you want the local preview to reach n8n too.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Form falls back to WhatsApp; console shows CORS | Allowed Origins mismatch, above |
| n8n returns 404 | Workflow not **Activated**, or the Test URL was used instead of Production |
| Meta returns 131030 | Recipient not in the test number's allowed list (step 1.4) |
| Meta returns 132001 | Template name or language does not match — must be `vedajyothi_enquiry` / `en` |
| Meta returns 132000 | Wrong number of variables — the template needs exactly 5 |
| Worked yesterday, dead today | The 24-hour temporary token expired; use the permanent one (step 1.6) |
| Nothing arrives, no error | Check n8n **Executions** — the Code node rejects a post with no name or phone |

Template variables cannot contain newlines, tabs or leading/trailing spaces, and
cannot be empty. The Code node already flattens newlines to `·` and substitutes
`-` for blanks, which is what stops a multi-line visitor message from being
rejected by Meta.
