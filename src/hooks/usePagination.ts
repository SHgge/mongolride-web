import { useState } from 'react';
import { PAGE_SIZE } from '../utils/constants';

export function usePagination(totalCount: number, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    page,
    totalPages,
    setPage,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    next: () => setPage((p) => Math.min(p + 1, totalPages)),
    prev: () => setPage((p) => Math.max(p - 1, 1)),
  };
}
