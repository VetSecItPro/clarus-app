import { redirect } from "next/navigation"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ItemPage({ params }: PageProps) {
  const { id } = await params
  redirect(`/chat/${id}`)
}
