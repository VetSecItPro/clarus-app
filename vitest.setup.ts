import "@testing-library/jest-dom/vitest"

// Environment variables needed by API route modules that read process.env
// at module load time. Setting them here guarantees they are available
// before any test file imports a route handler.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co"
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-key"
process.env.OPENROUTER_API_KEY ??= "test-openrouter-key"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key"
