import { supabase } from '@/services/supabase';

export type EnhanceTextField = 'title' | 'description';

type EnhanceTextResponse = {
  enhanced_text: string;
};

export async function enhanceListingText(text: string, field: EnhanceTextField) {
  const { data, error } = await supabase.functions.invoke<EnhanceTextResponse>('enhance-text', {
    body: { text, field },
  });

  if (error || !data) {
    return { data: null, error: error?.message ?? 'AI enhancement is temporarily unavailable' };
  }

  return { data: data.enhanced_text, error: null };
}
