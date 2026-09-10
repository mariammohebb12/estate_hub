import { supabase } from '@/services/supabase';
import { getFriendlyErrorMessage } from '@/utils/error-message';

export type EnhanceTextField = 'title' | 'description';

type EnhanceTextResponse = {
  enhanced_text: string;
};

export async function enhanceListingText(text: string, field: EnhanceTextField) {
  const { data, error } = await supabase.functions.invoke<EnhanceTextResponse>('enhance-text', {
    body: { text, field },
  });

  if (error || !data) {
    if (error) console.error('enhanceListingText: Edge Function call failed', error);
    return { data: null, error: error ? getFriendlyErrorMessage(error) : 'AI enhancement is temporarily unavailable.' };
  }

  return { data: data.enhanced_text, error: null };
}
