import { createOpenAI } from '@ai-sdk/openai';
import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';

const DENIAL_REASON = 'ACCESS_DENIED_SENTINEL';

if (!process.env.OPENAI_API_KEY) {
  console.error('Set OPENAI_API_KEY before running this reproduction.');
  process.exit(1);
}

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
let executeCalled = false;

const result = await generateText({
  model: openai('gpt-5.6-terra'),
  prompt: `Use programmatic_tool_calling and run this JavaScript logic exactly once:

let rejected = false;
let value;
try {
  value = await tools.get_secret({});
} catch (error) {
  rejected = true;
  value = error instanceof Error ? error.message : String(error);
}
text(JSON.stringify({ rejected, value, valueType: typeof value }));

Do not call get_secret directly. After the program finishes, briefly report its JSON output.`,
  providerOptions: {
    openai: {
      parallelToolCalls: false,
      store: false,
    },
  },
  stopWhen: stepCountIs(10),
  toolApproval: {
    get_secret: {
      reason: DENIAL_REASON,
      type: 'denied',
    },
  },
  tools: {
    get_secret: tool({
      description: 'Returns a secret. This tool is denied by the application access policy.',
      execute: async () => {
        executeCalled = true;
        return { secret: 'execute should never run' };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ secret: z.string() }),
      providerOptions: {
        openai: {
          allowedCallers: ['programmatic'],
        },
      },
    }),
    // The runner is hosted by the OpenAI Responses API.
    programmatic_tool_calling: openai.tools.programmaticToolCalling(),
  },
});

const programResult = result.steps
  .flatMap(step => step.toolResults)
  .find(toolResult => toolResult.toolName === 'programmatic_tool_calling');

if (!programResult) {
  console.error('The model did not produce a program result. Try the reproduction again.');
  process.exit(2);
}

const output = programResult.output;
if (
  typeof output !== 'object' ||
  output === null ||
  !('result' in output) ||
  typeof output.result !== 'string'
) {
  console.error('Unexpected program output:', output);
  process.exit(2);
}

const observation = JSON.parse(output.result);

console.log('Tool execute callback called:', executeCalled);
console.log('Program observed:', observation);
console.log('Final model response:', result.text);

if (
  executeCalled === false &&
  observation.rejected === false &&
  observation.value === DENIAL_REASON &&
  observation.valueType === 'string'
) {
  console.log('\nBUG REPRODUCED: a denied program-owned tool call resolved as a string.');
  process.exit(0);
}

console.error('\nBug not reproduced. Expected the denied call to resolve with denial text.');
process.exit(2);
