const GROK_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_MODEL = 'grok-4-1-fast-reasoning';

const SYSTEM_PROMPT = `You are an expert local SEO marketer specializing in home services
and contractor businesses (dumpster rental, junk removal, landscaping, roofing, plumbing, HVAC, etc.).

Your job is to analyze photos taken by these businesses and generate SEO-optimized keyword phrases
that will help their Google Business Profile, website images, and social posts rank in local search.

When analyzing images you:
1. Identify the exact service or equipment shown (be specific — "20 yard roll-off dumpster" not just "dumpster")
2. Note relevant visual details customers care about (size, condition, type, residential vs commercial setting)
3. Think like a local customer typing into Google — what would they search to find this service?
4. Front-load the most important keyword (service type) first
5. Keep phrases concise and natural — how a real person searches, not keyword stuffing

You always return valid JSON only. No markdown, no explanation outside the JSON.`;

/**
 * Analyze an image and return SEO keyword suggestions using Grok.
 * @param {File} imageFile
 * @param {{ name: string, type: string }} business
 * @param {string} apiKey
 * @returns {Promise<{ keywords: string, subject: string, model: string }>}
 */
export async function analyzeImageForKeywords(imageFile, business, apiKey) {
  const base64 = await fileToBase64(imageFile);
  const mimeType = imageFile.type || 'image/jpeg';

  const userPrompt = `Analyze this photo for a ${business.type} business called "${business.name}".

Generate an SEO keyword phrase (3-6 words, lowercase, no city/state names) that describes exactly what is shown.
Also write one sentence describing what you see.

Respond with JSON only in this exact format:
{"keywords": "...", "subject": "..."}

Keyword examples: "20 yard dumpster residential driveway", "full junk removal truck load", "roll off container concrete debris"`;

  const body = JSON.stringify({
    model: GROK_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: userPrompt },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 256,
  });

  const res = await fetch(GROK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error('[Grok] error', res.status, errData);
    const errMsg = errData.error?.message || `Grok API error ${res.status}`;

    if (res.status === 401 || res.status === 403) {
      throw new Error('Invalid Grok API key. Get one at console.x.ai.');
    }
    if (res.status === 429) {
      throw new Error('Grok rate limit hit. Wait a moment and try again.');
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  console.log('[Grok] raw response:', text);

  if (!text) {
    throw new Error('Grok returned an empty response.');
  }

  const parsed = extractJson(text);
  if (!parsed) {
    console.error('[Grok] unparseable response:', JSON.stringify(text));
    throw new Error('Could not parse Grok response. Check console for details.');
  }

  return { ...parsed, model: GROK_MODEL };
}

function extractJson(text) {
  try { return JSON.parse(text); } catch (_) { /* fall through */ }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) { /* fall through */ }
  }
  return null;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
