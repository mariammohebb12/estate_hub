import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { getCurrentMode, updateCurrentMode, type UserMode } from '@/services/profile';

type ModeContextValue = {
  mode: UserMode;
  isLoadingMode: boolean;
  setMode: (mode: UserMode) => Promise<void>;
};

const ModeContext = createContext<ModeContextValue>({
  mode: 'buy',
  isLoadingMode: true,
  setMode: async () => {},
});

export function ModeProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [mode, setModeState] = useState<UserMode>('buy');
  const [isLoadingMode, setIsLoadingMode] = useState(true);

  useEffect(() => {
    if (!userId) {
      setModeState('buy');
      setIsLoadingMode(false);
      return;
    }

    let cancelled = false;
    setIsLoadingMode(true);
    getCurrentMode(userId).then(({ data }) => {
      if (!cancelled) {
        setModeState(data);
        setIsLoadingMode(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setMode = useCallback(
    async (nextMode: UserMode) => {
      if (!userId) return;
      const previousMode = mode;
      setModeState(nextMode);

      const { error } = await updateCurrentMode(userId, nextMode);
      if (error) {
        console.error('ModeProvider.setMode: failed to update current_mode', error);
        setModeState(previousMode);
      }
    },
    [userId, mode],
  );

  return <ModeContext.Provider value={{ mode, isLoadingMode, setMode }}>{children}</ModeContext.Provider>;
}

export function useMode() {
  return useContext(ModeContext);
}
