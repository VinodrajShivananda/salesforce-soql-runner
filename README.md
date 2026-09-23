# Salesforce SOQL Runner

A Vercel-compatible Next.js app for running SOQL against a Salesforce org.

## Prerequisites

- Node.js 18 or newer
- A Salesforce Connected App with OAuth enabled
- A Salesforce org and a callback URL configured as `/api/auth/callback`

Copy `.env.example` to `.env.local` and provide the Connected App credentials. Use `https://login.salesforce.com` for production orgs or `https://test.salesforce.com` for sandboxes.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, click **Connect Salesforce**, then:

1. Authenticate with Salesforce.
2. Enter a query in the editor.
3. Run the query and inspect the records in the results table.

The server exchanges the OAuth code and stores a signed, HTTP-only session cookie. Access tokens are never sent to the browser. Deploy it to Vercel by importing this repository and adding the variables from `.env.example` to the project settings. Set the Connected App callback URL to `https://your-vercel-domain/api/auth/callback`.
