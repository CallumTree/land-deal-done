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
    const systemPrompt = `You are an experienced UK Quantity Surveyor and Development Consultant with deep expertise in residential development feasibility and costing.

${projectContext ? `Current Project Context:
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

Your role:
- Provide expert advice on feasibility, costing, ROI, and general development matters
- Use UK market standards and typical costs (e.g., build costs per m², professional fees, CIL/S106)
- Be friendly, professional, and use plain English
- Reference the project context when relevant
- Offer practical, actionable insights

Key knowledge areas:
- Build costs per m² (vary by spec and region)
- Professional fee norms (architects 3-8%, engineers 1-3%, QS 1-2%, etc.)
- ROI and profit margin expectations (15-20% typical for residential)
- Viability checks and sensitivity analysis
- Survey costs, planning fees, legal costs
- Lender presentation standards and financing structures`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
