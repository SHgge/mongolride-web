import { useEffect, useState } from 'react';
import { profileService } from '../services/profile.service';
import type { Profile } from '../types/user.types';

export function useLeaderboard(limit = 10) {
  const [leaders, setLeaders] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    profileService.getLeaderboard(limit).then(({ data }) => {
      setLeaders(data);
      setLoading(false);
    });
  }, [limit]);

  return { leaders, loading };
}
