import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { match } from 'fuzzyjs';
import fs from 'fs';
import path from 'path';

interface ChatRequest {
    message: string;
    sessionId: string;
}

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY!,
});

export async function POST(req: Request) {
    let body: ChatRequest;
    try {
        body = await req.json();
    } catch (err) {
        console.error("❌ Invalid JSON in request body", err);
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { message, sessionId } = body;
    console.log("📥 Incoming request:", { message, sessionId });

    if (!message || typeof message !== 'string') {
        return NextResponse.json({ error: 'Message is required and must be a string' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
        return NextResponse.json({ error: 'Groq API key not set' }, { status: 500 });
    }

    let neighborhoods: any[];
    try {
        const neighborhoodsPath = path.join(process.cwd(), 'src', 'data', 'neighborhoods.json');
        const raw = fs.readFileSync(neighborhoodsPath, 'utf-8');
        neighborhoods = JSON.parse(raw);
    } catch (err) {
        console.error("❌ Error reading neighborhoods.json", err);
        return NextResponse.json({ error: 'Internal data error' }, { status: 500 });
    }

    const lowerMessage = message.toLowerCase();
    const matchedNeighborhood = neighborhoods.reduce<{ score: number } & Record<string, any>>(
        (best, n) => {
            const score = match(n.name.toLowerCase(), lowerMessage).score;
            return score > (best.score || 0) ? { ...n, score } : best;
        },
        { score: 0 }
    );

    const neighborhood = matchedNeighborhood.score > 0.7 ? matchedNeighborhood : null;

    // Enhanced system prompt for better chat formatting and expertise
    let systemPrompt = `You are a South Florida climate risk specialist with expertise in flood modeling, urban planning, and resilience strategies. Your responses should be:

FORMATTING GUIDELINES:
- Use clean, chat-friendly formatting without excessive line breaks
- Keep risk percentages and measurements on the same line (e.g., "High – 40% chance" not "High\n40% chance")
- Use clear sections with proper spacing but avoid overly fragmented text
- Present numerical data inline with descriptions
- Use bullet points sparingly and only for clear action items

RESPONSE STYLE:
- Lead with the most critical risk information
- Provide specific, actionable recommendations
- Reference local South Florida conditions and regulations
- Include realistic timelines and cost considerations when relevant
- Mention relevant agencies (FEMA, SFWMD, local emergency management)

TECHNICAL ACCURACY:
- Base flood risk assessments on FEMA flood zones, historical data, and sea level rise projections
- Reference current building codes (Florida Building Code, local ordinances)
- Include insurance implications (NFIP rates, flood insurance requirements)
- Consider compound risks (storm surge + rainfall, heat + flooding)`;

    if (neighborhood) {
        systemPrompt += `

SPECIFIC NEIGHBORHOOD CONTEXT:
Name: ${neighborhood.name}
Description: ${neighborhood.description}
Current Flood Risk: ${neighborhood.climate_parameters.flood_risk}
Storm Surge Potential: ${neighborhood.climate_parameters.storm_surge}
Heat Risk: ${neighborhood.climate_parameters.heat_index}
Sea Level Rise Projection: ${neighborhood.climate_parameters.sea_level_rise}
Precipitation Trends: ${neighborhood.climate_parameters.precipitation_trends}
Wind Risk: ${neighborhood.climate_parameters.wind_risk}
Coastal Erosion: ${neighborhood.climate_parameters.coastal_erosion}
Groundwater Intrusion: ${neighborhood.climate_parameters.groundwater_intrusion}
Infrastructure Resilience: ${neighborhood.climate_parameters.infrastructure_resilience}
Adaptation Cost Estimate: ${neighborhood.climate_parameters.adaptation_cost_estimate}
Overall Vulnerability: ${neighborhood.vulnerability}
Recommended Solutions: ${neighborhood.solutions}

Use this data to provide specific, localized advice. Reference the exact risk levels and tailor solutions to this neighborhood's characteristics.`;
    }

    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
    ];

    try {
        const response = await groq.chat.completions.create({
            model: 'openai/gpt-oss-120b',
            messages,
            temperature: 0.7,
            max_tokens: 4096,
            top_p: 0.9,
            frequency_penalty: 0.1,
        });

        const aiResponse = response.choices?.[0]?.message?.content;

        if (!aiResponse) {
            console.error("❌ No content in AI response:", response);
            return NextResponse.json({ error: 'Empty response from model' }, { status: 500 });
        }

        const location = neighborhood ? { lat: neighborhood.lat, lon: neighborhood.lon } : null;

        console.log("🤖 AI Response:", aiResponse);
        if (location) console.log("📍 Location matched:", location);

        return NextResponse.json({ parsed: { response: aiResponse, location } });
    } catch (err: any) {
        console.error("❌ Error from groq.chat.completions.create", err);
        return NextResponse.json({ error: 'Chat processing failed', details: err.message }, { status: 500 });
    }
}