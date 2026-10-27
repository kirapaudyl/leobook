import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const SYSTEM = `You are Leo, the in-app guide for LeoBook, a community platform where people find volunteering events, join campaigns, follow verified organizations and respond to urgent blood-donation requests from verified hospitals.
Be brief, warm and practical. Never give medical advice beyond pointing people to the requesting hospital or a clinician. If you don't know something about the app, say so.`;

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "Ask Leo isn't configured yet. Add ANTHROPIC_API_KEY." }, { status: 503 });

  const { messages } = (await req.json()) as { messages?: { role: 'user' | 'assistant'; content: string }[] };
  if (!Array.isArray(messages) || messages.length === 0) return NextResponse.json({ error: 'No message.' }, { status: 400 });

  const { data: profile } = await supabase.from('profiles').select('full_name, location, skills').eq('id', user.id).single();
  const context = `Member: ${profile?.full_name ?? 'unknown'}; location: ${profile?.location ?? 'unknown'}; skills: ${(profile?.skills ?? []).join(', ') || 'none listed'}.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5',
      max_tokens: 600,
      system: `${SYSTEM}\n${context}`,
      messages: messages.slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
    }),
  });
  if (!res.ok) return NextResponse.json({ error: 'Leo is unavailable right now. Try again shortly.' }, { status: 502 });
  const json = await res.json();
  const reply = (json.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n');
  return NextResponse.json({ reply });
}
