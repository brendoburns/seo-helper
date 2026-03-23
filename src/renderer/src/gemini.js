const MODELS = [
  'gemini-2.5-flash',      // best quality, free tier
  'gemini-2.0-flash',      // stable fallback
  'gemini-2.0-flash-lite', // lightest, lowest quota usage
];

function geminiUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

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
 * Analyze an image and return SEO keyword suggestions.
 * @param {File} imageFile
 * @param {{ name: string, type: string }} business
 * @param {string} apiKey
 * @param {string} [preferredModel]
 * @returns {Promise<{ keywords: string, subject: string }>}
 */
export async function analyzeImageForKeywords(imageFile, business, apiKey, preferredModel) {
  const base64 = await fileToBase64(imageFile);
  const mimeType = imageFile.type || 'image/jpeg';

  const userPrompt = `Analyze this photo for a ${business.type} business called "${business.name}".

Return ONLY this JSON structure:
{
  "keywords": "3-6 word seo phrase describing exactly what is shown",
  "subject": "one sentence describing what you see in the photo"
}

Keyword rules:
- 3 to 6 words, all lowercase, words separated by spaces
- Describe the specific service or equipment visible (be specific about size/type if visible)
- Do NOT include city or state names — location is added separately
- Examples: "20 yard dumpster residential driveway", "full junk removal truck load", "roll off container concrete debris"`;

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: userPrompt },
      ],
    }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
  });

  // Try preferred model first, then fall back through the list
  const tryOrder = preferredModel
    ? [preferredModel, ...MODELS.filter((m) => m !== preferredModel)]
    : MODELS;

  let lastError = null;
  for (const model of tryOrder) {
    const res = await fetch(`${geminiUrl(model)}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*?\}/);
      if (!match) throw new Error('Could not parse Gemini response');
      return { ...JSON.parse(match[0]), model };
    }

    const errData = await res.json().catch(() => ({}));
    const errMsg = errData.error?.message || `Gemini API error ${res.status}`;

    // Quota exhausted — try next model
    if (res.status === 429 || errMsg.toLowerCase().includes('quota')) {
      const retryMatch = errMsg.match(/retry in ([\d.]+)s/i);
      const retrySecs = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
      lastError = retrySecs
        ? `Quota exceeded on ${model}. Retry in ${retrySecs}s.`
        : `Quota exceeded on ${model}, trying next model…`;
      continue;
    }

    // Model not found — likely a key/project issue, not a model name issue
    if (res.status === 404 || errMsg.toLowerCase().includes('not found')) {
      lastError = `Model not available for this API key. Try a different model in Settings, or get a free key at aistudio.google.com.`;
      continue;
    }

    // Auth error — bad key, stop immediately
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error('Invalid API key. Get a free key at aistudio.google.com → Get API key.');
    }

    throw new Error(errMsg);
  }

  throw new Error(lastError || 'All Gemini models quota exceeded. Try again later.');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
