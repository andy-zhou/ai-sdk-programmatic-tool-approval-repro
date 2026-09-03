# AI SDK programmatic tool approval repro

Minimal reproduction for an interaction between:

- Vercel AI SDK `toolApproval`
- `@ai-sdk/openai`
- OpenAI Responses API Programmatic Tool Calling
- a function restricted to `allowedCallers: ['programmatic']`

When the application denies a program-owned function call, the function's `execute` callback is
correctly skipped. However, the hosted JavaScript program receives the denial reason as the resolved
value of `await tools.get_secret({})`. The promise does not reject.

This lets ordinary defensive code accidentally turn an access denial into plausible empty data. For
example, if the denied value is a string, `result?.nodes ?? []` evaluates to `[]`.

## Run

Requires Node.js 20+ and an OpenAI API key with access to `gpt-5.6-terra`.

```bash
npm install
OPENAI_API_KEY=... npm run repro
```

The command makes API requests and may incur usage charges.

## Expected behavior

The nested call should reject, abort the program, or otherwise produce a structured failure that
cannot be mistaken for the tool's declared output:

```js
await tools.get_secret({}); // rejects or suspends
```

## Actual behavior

The access policy denies the call and `execute` is never invoked, but the promise resolves:

```js
await tools.get_secret({}); // => "ACCESS_DENIED_SENTINEL"
```

Representative output:

```text
Tool execute callback called: false
Program observed: {
  rejected: false,
  value: 'ACCESS_DENIED_SENTINEL',
  valueType: 'string'
}

BUG REPRODUCED: a denied program-owned tool call resolved as a string.
```

## Why this appears to happen

AI SDK represents the policy decision as an `execution-denied` tool output. The OpenAI provider
adapter serializes that denial into a normal `function_call_output`. For a call whose `caller` is a
hosted program, that output becomes the fulfilled value of the JavaScript tool promise.

The reproduction includes an `outputSchema` intentionally. The denied string violates the declared
`{ secret: string }` result shape but still reaches the program as a successful value.

OpenAI's documentation describes opting functions into Programmatic Tool Calling with
`allowed_callers` and preserving the `call_id` and `caller` linkage:
[Programmatic Tool Calling](https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling).

## Versions

Reproduced with:

- `ai@7.0.66`
- `@ai-sdk/openai@4.0.42`
- `zod@4.4.3`
- `gpt-5.6-terra`
