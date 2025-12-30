export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenAIResponse = {
  content: string;
};

export async function callOpenAI(
  apiKey: string,
  messages: OpenAIMessage[],
  model: string,
  temperature = 0
): Promise<OpenAIResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorBody}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response missing content.");
  }

  return { content };
}
