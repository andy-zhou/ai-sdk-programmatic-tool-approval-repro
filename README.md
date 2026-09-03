# AI SDK programmatic tool approval repro

Minimal reproduction of a denied AI SDK tool call resolving instead of rejecting inside OpenAI
Programmatic Tool Calling.

## Run

```bash
npm install
OPENAI_API_KEY=... npm run repro
```

Requires Node.js 20+ and access to `gpt-5.6-terra`. The command makes API requests and may incur
usage charges.

## Bug

`get_secret` is restricted to programmatic callers and denied through `toolApproval`. Its `execute`
callback is correctly skipped, but the hosted program receives the denial reason as a successful
return value:

```js
await tools.get_secret({}); // resolves to "ACCESS_DENIED_SENTINEL"
```

Expected: the call rejects or otherwise surfaces a structured failure. Actual: it resolves to a
string that violates the declared `{ secret: string }` output schema.

## Versions

- `ai@7.0.91`
- `@ai-sdk/openai@4.0.57`
- `gpt-5.6-terra`

[OpenAI Programmatic Tool Calling documentation](https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling)
