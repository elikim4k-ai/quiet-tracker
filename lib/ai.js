// Provider-agnostic AI client: OpenAI, xAI Grok (OpenAI-compatible), or Google Gemini.

export async function aiComplete(settings, { system, user, json = false }) {
  const provider = settings.aiProvider || 'openai';
  if (provider === 'gemini') return geminiComplete(settings, { system, user, json });
  if (provider === 'grok') {
    if (!settings.grokApiKey) throw new Error('No Grok API key set. Add one in Settings.');
    return openaiCompatible({
      url: 'https://api.x.ai/v1/chat/completions',
      apiKey: settings.grokApiKey,
      model: settings.grokModel || 'grok-4-fast',
      label: 'Grok',
    }, { system, user, json });
  }
  if (!settings.openaiApiKey) throw new Error('No OpenAI API key set. Add one in Settings.');
  return openaiCompatible({
    url: 'https://api.openai.com/v1/chat/completions',
    apiKey: settings.openaiApiKey,
    model: settings.openaiModel || 'gpt-4o-mini',
    label: 'OpenAI',
  }, { system, user, json });
}

async function openaiCompatible({ url, apiKey, model, label }, { system, user, json }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${label} error: ${data.error?.message || data.error || res.status}`);
  return data.choices[0].message.content;
}

async function geminiComplete(settings, { system, user, json }) {
  if (!settings.geminiApiKey) throw new Error('No Gemini API key set. Add one in Settings.');
  const model = settings.geminiModel || 'gemini-flash-latest';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.7,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini error: ${data.error?.message || res.status}`);
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}

export function parseJsonLoose(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'));
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function outreachSystemPrompt(settings) {
  const sender = [settings.senderName, settings.senderTitle].filter(Boolean).join(', ');
  return `You are the outreach assistant for WISER, writing on behalf of ${sender || 'a WISER team member'} (${settings.senderEmail || 'email in signature'}).

ABOUT WISER:
${settings.orgProfile}

RULES:
- Warm, concise, professional. No hype, no exclamation marks, no buzzword salad.
- Emails: under 160 words, clear single ask, subject line under 60 chars.
- LinkedIn connection notes: under 280 characters. LinkedIn messages: under 100 words.
- The ask is always a short intro call to discuss the Insider Program partnership.
- Emphasize the two-way value: exclusive platform access for WISER's student/researcher community, promotion of the company's product through WISER's channels.
- Never invent facts about the target company beyond what is provided.
- Sign off with the sender's name and title.`;
}
