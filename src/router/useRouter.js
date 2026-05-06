import { useState, useCallback } from 'react';

// Simple state-machine router — no react-router-dom needed
export function useRouter(initial = { page: 'servers', params: {} }) {
  const [location, setLocation] = useState(initial);

  const navigate = useCallback((page, params = {}) => {
    setLocation({ page, params });
  }, []);

  return { ...location, navigate };
}
