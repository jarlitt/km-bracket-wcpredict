import { redirect } from 'next/navigation'

export default async function PredictIndex({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/pools/${slug}/predict/groups`)
}
