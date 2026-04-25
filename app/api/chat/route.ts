import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1';
    const model = process.env.ANTHROPIC_MODEL || 'meta-llama/llama-3.3-70b-instruct';


    if (!apiKey) {
      console.error('OpenRouter API key is missing!');
      return Response.json({
        error: 'API key not configured. Please add ANTHROPIC_API_KEY to .env.local'
      }, { status: 500 });
    }

    console.log('Calling OpenRouter AI with model:', model);

    // Simply forward the request to OpenRouter
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Agent Dashboard'
      },
      body: JSON.stringify({
        model: model,
        messages: messages, // Just send what user wrote
        temperature: 0.7,
        max_tokens: 2048,
        stream: true
      })
    });

    // If API call fails (network issue, credits, etc.)
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);

      // Simple fallback for any type of API failure
      return handleFallback(messages);
    }

    // Stream the response back exactly as received
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          controller.close();
          return;
        }

        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                  const jsonStr = line.slice(6);
                  const parsed = JSON.parse(jsonStr);

                  // Forward all content exactly as received
                  if (parsed.choices[0]?.delta?.content) {
                    const content = parsed.choices[0].delta.content;
                    controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
                  }

                  // Forward tool calls if any
                  if (parsed.choices[0]?.delta?.tool_calls) {
                    controller.enqueue(encoder.encode(`c:${JSON.stringify(parsed.choices[0].delta.tool_calls)}\n`));
                  }
                } catch (e) {
                  console.error('Failed to parse SSE message:', e);
                }
              }
            }
          }

          controller.close();
        } catch (error) {
          console.error('Stream processing error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    // Simple fallback for network issues
    return handleFallback([]);
  }
}

// Simple fallback - just tells user there's an API issue
async function handleFallback(messages: any[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const fallbackMessage = "⚠️ The AI service is currently unavailable (API credits may be exhausted or network issue). Please check your OpenRouter API key and credits at https://openrouter.ai/credits";
      controller.enqueue(encoder.encode(`0:${JSON.stringify(fallbackMessage)}\n`));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}