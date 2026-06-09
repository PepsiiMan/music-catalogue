import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { AlbumsPage } from "./pages/AlbumsPage"
import { HomePage } from "./pages/HomePage"
import { SearchPage } from "./pages/SearchPage"
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom"
import { Layout } from "./components/Layout"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { AnimatePresence } from "motion/react"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60,
    },
  },
})

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />}/>
        <Route path="/albums" element={<AlbumsPage />}/>
        <Route path="/search" element={<SearchPage />}/>
      </Routes>
    </AnimatePresence>
  )
}

export default function App(){
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
      <Layout>
      <ErrorBoundary>
      <AnimatedRoutes />
      </ErrorBoundary>
      </Layout>
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
