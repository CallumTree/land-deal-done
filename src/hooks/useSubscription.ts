import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SubscriptionTier } from '@/utils/subscriptionHelpers';

interface SubscriptionData {
  tier: SubscriptionTier;
  status: string;
  loading: boolean;
}

export const useSubscription = () => {
  const [subscription, setSubscription] = useState<SubscriptionData>({
    tier: 'free',
    status: 'active',
    loading: true,
  });

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setSubscription({ tier: 'free', status: 'active', loading: false });
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('subscription_tier, subscription_status')
          .eq('id', user.id)
          .single();

        if (!profileError && profile) {
          const tier = (profile as any).subscription_tier as SubscriptionTier | undefined;
          const status = (profile as any).subscription_status as string | undefined;
          
          setSubscription({
            tier: tier || 'free',
            status: status || 'active',
            loading: false,
          });
        } else {
          setSubscription({ tier: 'free', status: 'active', loading: false });
        }
      } catch (error) {
        console.error('Error loading subscription:', error);
        setSubscription({ tier: 'free', status: 'active', loading: false });
      }
    };

    loadSubscription();
  }, []);

  return subscription;
};
