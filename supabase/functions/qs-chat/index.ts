import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, projectContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build system prompt with project context
    const systemPrompt = `You are an experienced UK Quantity Surveyor and Development Consultant.

CRITICAL INSTRUCTION: Your primary job is to answer the USER'S SPECIFIC QUESTION directly and concisely. Do NOT give generic project overviews unless explicitly asked.

${projectContext ? `Current Project Context (use ONLY when relevant to answer the user's question):
- Project: ${projectContext.name}
- Region: ${projectContext.region}
- Site Area: ${projectContext.siteArea} hectares
- GDV: £${projectContext.gdv?.toLocaleString() || 'N/A'}
- Total Cost: £${projectContext.buildCost?.toLocaleString() || 'N/A'}
- Net Profit: £${projectContext.netProfit?.toLocaleString() || 'N/A'}
- Profit Margin: ${projectContext.profitMargin?.toFixed(1) || 'N/A'}%
- Units: ${projectContext.units || 'N/A'}
- Density: ${projectContext.density?.toFixed(1) || 'N/A'} units/ha
` : ''}

HOW TO RESPOND:
1. Read the user's question carefully
2. Answer ONLY what they asked - be specific and direct
3. Use project data to support your answer (e.g., "Your ${projectContext?.profitMargin?.toFixed(1)}% margin is...")
4. Include relevant UK market benchmarks for comparison when applicable
5. Keep responses focused and actionable
6. If they ask "Is X good?", compare it to industry standards
7. If they ask about a specific metric, analyze that metric only

UK MARKET BENCHMARKS (use for comparison when relevant):
- Profit Margin: 15-20% typical, 20%+ excellent, <15% challenging
- Build Costs: £1,200-1,800/m² (medium spec), £1,800-2,500/m² (high spec)
- Professional Fees: 8-12% of build cost typical
- Contingency: 5-10% standard
- Finance Rate: 6-8% typical for development finance
- Land Cost as % of GDV: 15-25% typical
- Developer Profit: 15-20% on GDV typical
- Architect Fees: 3-8% of build cost
- Structural Engineer: 1-3% of build cost
- QS Fees: 1-2% of build cost
- Planning Fees: £500-2,000 per dwelling
- CIL/S106: Highly variable by location

RESPONSE STYLE:
- Be direct and specific
- Start with the answer, then explain
- Use numbers from the project data
- Compare to benchmarks when relevant
- Be friendly but professional
- Use plain English

EXAMPLES:
User: "Is my profit margin good?"
✅ Good: "Your ${projectContext?.profitMargin?.toFixed(1)}% profit margin is solid and sits within the typical 15-20% range for residential developments. It's above average, giving you decent headroom for unforeseen costs."
❌ Bad: "Let me review your project details. You have a GDV of £X, total costs of £Y..."

User: "What should my build cost be?"
✅ Good: "For a medium-spec development in ${projectContext?.region || 'your region'}, expect £1,400-1,600/m². I'd need your total floor area to calculate a target, but typical costs are £1,200-1,800/m² for medium spec."
❌ Bad: "Build costs vary significantly. Let's look at your project..."

User: "Should I proceed with this development?"
✅ Good: "Based on your ${projectContext?.profitMargin?.toFixed(1)}% margin and £${projectContext?.netProfit?.toLocaleString()} net profit, the numbers look viable. However, consider: 1) Your finance costs, 2) Market absorption rate in ${projectContext?.region}, 3) Planning risk. I'd recommend a sensitivity analysis before committing."
❌ Bad: "That's a complex question. Your project has X units at Y density..."`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('QS chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
