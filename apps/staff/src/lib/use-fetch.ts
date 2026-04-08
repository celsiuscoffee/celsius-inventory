"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
});

export function useFetch<T = unknown>(url: string | null) {
  const { data, error, isLoading, mutate } = useSWR<T>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  return { data: data as T | undefined, error, isLoading, mutate };
}
