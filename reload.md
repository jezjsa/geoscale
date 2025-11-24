Short version: React itself is not doing this - it is usually one of these:

Full page navigation instead of SPA routing

A data library refetching "on window focus"

Dev tooling (Vite/CRA hot reload) in development

Or the browser genuinely discarding the tab on low memory (mostly mobile)

Here is how to tame it when you build your app with React + TypeScript.

1. Use client side routing, not full page loads

If you are using React Router, you must use its <Link> and navigation helpers, not plain <a> tags for internal routes.

Bad - this will cause a full browser reload:

<a href="/dashboard">Dashboard</a>


Good - SPA navigation, React state stays in memory:

import { Link } from "react-router-dom";

<Link to="/dashboard">Dashboard</Link>


Or programmatic navigation:

import { useNavigate } from "react-router-dom";

const Component = () => {
  const navigate = useNavigate();

  const goToDashboard = () => {
    navigate("/dashboard"); // no reload
  };

  return <button onClick={goToDashboard}>Dashboard</button>;
};


Also avoid:

window.location.href = "/dashboard";
window.location.replace("/dashboard");


Use the router instead.

2. Turn off "refetch on focus" in data fetching

Many React data libraries intentionally refetch when the tab gets focus again. That can feel like a reload.

TanStack Query / React Query

Disable globally:

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});


Or per query:

useQuery({
  queryKey: ["projects"],
  queryFn: fetchProjects,
  refetchOnWindowFocus: false,
});

SWR

Disable globally:

<SWRConfig value={{ revalidateOnFocus: false }}>
  <App />
</SWRConfig>


Or per hook:

useSWR("/api/projects", fetcher, {
  revalidateOnFocus: false,
});


If you use Supabase hooks or custom hooks, check if you are re-running a big request on visibilitychange or focus.

3. Separate "refetch data" from "reset page state"

If you do want to refetch data when the user comes back to a tab, try not to reset state like filters, expanded rows, pagination etc.

Example:

const [filters, setFilters] = useState<Filters>(() => {
  const cached = sessionStorage.getItem("filters");
  return cached ? JSON.parse(cached) : defaultFilters;
});

useEffect(() => {
  sessionStorage.setItem("filters", JSON.stringify(filters));
}, [filters]);


Then even if the query refetches, your UI state remains.

4. Check if it is just dev hot reload

In development with Vite or CRA, whenever you edit files, the dev server may do:

Module hot replacement, or

A full page reload if it cannot patch safely

That can look like React "reloading" when you come back to the tab while coding.

In production:

Built bundle on a proper server

No dev hot reload

You should not see that behaviour

So test in a production build too:

npm run build
npm run preview  # Vite

5. Preserve important state across real reloads

On some devices (especially mobile) the browser really does kill background tabs. You cannot stop that, but you can make it almost invisible:

Persist auth tokens in httpOnly cookies or secure storage

Persist key UI state in localStorage or sessionStorage

Hydrate state on mount

Example pattern:

function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = React.useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : initial;
  });

  React.useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}


Then:

const [selectedMonth, setSelectedMonth] = usePersistentState(
  "selectedMonth",
  "2025-11"
);


So even if the tab does reload, the user lands back in the same place.

6. React specific gotchas

If you are using StrictMode in development, React will double invoke some lifecycle / effect logic. That can trigger double fetches and make things look like a reload. It will not happen in production, but you can temporarily remove <React.StrictMode> to debug.

Check any window.addEventListener("focus", ...) or document.addEventListener("visibilitychange", ...) code that might be calling your initialisation logic again.