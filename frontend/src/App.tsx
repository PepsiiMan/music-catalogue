import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { AlbumsPage } from "./pages/AlbumsPage"
import { HomePage } from "./pages/HomePage"
import { SearchPage } from "./pages/SearchPage"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Layout } from "./components/Layout"
import { ErrorBoundary } from "./components/ErrorBoundary"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60,
    },
  },
})

export default function App(){
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
      <Layout>
      <ErrorBoundary>
      <Routes>
        <Route path="/" element={<HomePage />}/>
        <Route path="/albums" element={<AlbumsPage />}/>
        <Route path="/search" element={<SearchPage />}/>
      </Routes>
      </ErrorBoundary>
      </Layout>
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}

// export default App
