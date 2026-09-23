# Salesforce SOQL Runner

A Vercel-compatible Next.js app for running SOQL against a Salesforce org.

## Prerequisites

- Node.js 18 or newer
- A Salesforce Connected App with the OAuth password grant enabled
- A Salesforce user with API access and, where required, a security token

Copy `.env.example` to `.env.local` and provide the Connected App credentials. Use `https://login.salesforce.com` for production orgs or `https://test.salesforce.com` for sandboxes.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, click **Connect Salesforce**, then enter your Salesforce username, password, and security token if your org requires one.

1. Enter your credentials. They are sent over HTTPS to the server and are not persisted.
2. Enter a query in the editor.
3. Run the query and inspect the records in the results table.

The server exchanges the credentials for a Salesforce access token and stores a signed, HTTP-only session cookie. Access tokens are never exposed to browser JavaScript. Deploy it to Vercel by importing this repository and adding the variables from `.env.example` to the project settings.
