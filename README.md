# Salesforce SOQL Runner

A Vercel-compatible Next.js app for running SOQL against a Salesforce org.

## Prerequisites

- Node.js 18 or newer
- A Salesforce user with API access and, where required, a security token

Copy `.env.example` to `.env.local` and set a long random `SESSION_SECRET`.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, click **Connect Salesforce**, choose Production or Sandbox, then enter your Salesforce username and password with the security token appended when your org requires one.

1. Enter your credentials. They are sent over HTTPS to the server and are not persisted.
2. Enter a query in the editor.
3. Run the query and inspect the records in the results table.

The server exchanges the credentials through Salesforce SOAP login and stores a signed, HTTP-only session cookie. Access tokens are never exposed to browser JavaScript. Deploy it to Vercel by importing this repository and adding `SESSION_SECRET` to the project settings.
