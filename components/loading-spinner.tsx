export default function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 border-4 border-gray-700 border-t-gray-300 rounded-full animate-spin mb-4"></div>
      <p className="text-gray-300">{message}</p>
    </div>
  )
}
