import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { CATEGORY_OPTIONS, CITY_OPTIONS } from "./jobFormOptions";

export type CategoryOption = { value: string; label: string };
export type CityOption = { value: string; label: string };

type ApiItem = { slug: string; name: string; sort_order: number };

/** Fetch categories from API (admin-managed). Falls back to static list on error. */
export async function fetchCategories(): Promise<CategoryOption[]> {
  try {
    const list = await apiFetch<ApiItem[]>("/api/categories/");
    if (Array.isArray(list) && list.length > 0) {
      return list.map((c) => ({ value: c.slug, label: c.name }));
    }
  } catch {
    // ignore
  }
  return [...CATEGORY_OPTIONS];
}

/** Fetch cities from API (admin-managed). Falls back to static list on error. */
export async function fetchCities(): Promise<CityOption[]> {
  try {
    const list = await apiFetch<ApiItem[]>("/api/cities/");
    if (Array.isArray(list) && list.length > 0) {
      return list.map((c) => ({ value: c.slug, label: c.name }));
    }
  } catch {
    // ignore
  }
  return [...CITY_OPTIONS];
}

/** Hook: fetch categories and cities from API on mount. Used by forms and landing. */
export function useCategoriesAndCities(): {
  categories: CategoryOption[];
  cities: CityOption[];
  loading: boolean;
} {
  const [categories, setCategories] = useState<CategoryOption[]>(() => [...CATEGORY_OPTIONS]);
  const [cities, setCities] = useState<CityOption[]>(() => [...CITY_OPTIONS]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchCategories(), fetchCities()])
      .then(([cats, cityList]) => {
        if (!cancelled) {
          setCategories(cats);
          setCities(cityList);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, cities, loading };
}

/** Hook: fetch only categories (e.g. landing page pills). */
export function useCategories(): {
  categories: CategoryOption[];
  loading: boolean;
} {
  const [categories, setCategories] = useState<CategoryOption[]>(() => [...CATEGORY_OPTIONS]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCategories()
      .then((list) => {
        if (!cancelled) {
          setCategories(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, loading };
}

/** Hook: fetch only cities (e.g. register form). */
export function useCities(): {
  cities: CityOption[];
  loading: boolean;
} {
  const [cities, setCities] = useState<CityOption[]>(() => [...CITY_OPTIONS]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCities()
      .then((list) => {
        if (!cancelled) {
          setCities(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { cities, loading };
}
