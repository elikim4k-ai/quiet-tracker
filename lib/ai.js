// Provider-agnostic AI client. Gemini has its own protocol; every other
// provider in lib/providers.js speaks OpenAI-compatible chat/completions.
import { providerFor, resolveModel, resolveKey, resolveUrl } from './providers.js';

export async function aiComplete(settings, { system, user, json = false }) {
  const p = providerFor(settings);
  const key = resolveKey(settings);
  if (!key) throw new Error(`No ${p.label} API key set. Add one in Settings.`);
  if (p.kind === 'gemini') return geminiComplete(settings, key, { system, user, json });
  const url = resolveUrl(settings);
  if (!url) throw new Error(`No base URL set for the custom provider. Add one in Settings.`);
  return openaiCompatible({ url, apiKey: key, model: resolveModel(settings), label: p.label }, { system, user, json });
}

async function openaiCompatible({ url, apiKey, model, label }, { system, user, json }) {
  if (!model) throw new Error(`No model set for ${label}. Add one in Settings.`);
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || data.error || data.message || res.status;
    throw new Error(`${label} error: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${label} returned an empty response.`);
  return text;
}

async function geminiComplete(settings, key, { system, user, json }) {
  const model = resolveModel(settings);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
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
