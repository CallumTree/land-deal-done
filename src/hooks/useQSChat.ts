import { useState, useCallback } from 'react';
import { Project } from '@/types/project';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const useQSChat = (project: Project | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim()) return;

    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const projectContext = project ? {
        name: project.name,
        region: project.location,
        siteArea: project.inputs?.siteArea,
        gdv: project.gdv,
        buildCost: project.buildCost,
        netProfit: project.netProfit,
        profitMargin: project.profitMargin,
        units: project.units,
        density: project.density,
      } : null;

      if (!import.meta.env.VITE_SUPABASE_URL) {
        await new Promise(r => setTimeout(r, 600));
        const gdvStr = project?.gdv ? `£${(project.gdv / 1000000).toFixed(2)}M` : '£0';
        const buildCostStr = project?.buildCost ? `£${(project.buildCost / 1000000).toFixed(2)}M` : '£0';
        const profitMarginStr = project?.profitMargin ? `${project.profitMargin.toFixed(1)}%` : '0%';
        const reply: ChatMessage = {
          role: 'assistant',
          content: `**AI Quantity Surveyor Analysis:**\n\nFor **${project?.name || 'this scheme'}** (${project?.units ?? 0} units, ${project?.location || 'UK'}):\n- **GDV**: ${gdvStr}\n- **Build Cost**: ${buildCostStr}\n- **Net Margin**: ${profitMarginStr}\n\n*Note: To enable live streaming LLM evaluations via your Supabase edge function, provide your \`VITE_SUPABASE_URL\` and \`VITE_SUPABASE_PUBLISHABLE_KEY\`.*`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, reply]);
        setIsLoading(false);
        return;
      }

      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qs-chat`;
      
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, newUserMessage].map(m => ({ role: m.role, content: m.content })),
          projectContext,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let textBuffer = '';

      // Create placeholder for assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: assistantContent,
                };
                return updated;
              });
            }
          } catch {
            // Partial JSON, wait for more data
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setIsLoading(false);
      
      // Remove the placeholder assistant message on error
      setMessages(prev => prev.filter(m => m.content !== ''));
    }
  }, [messages, project]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const exportToNotes = useCallback(() => {
    return messages.map(m => 
      `**${m.role === 'user' ? 'You' : 'QS'}**: ${m.content}`
    ).join('\n\n');
  }, [messages]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    exportToNotes,
  };
};
