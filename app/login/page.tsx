import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="flex flex-col items-center gap-2">
        {/* Swap in the real U& logo SVG here */}
        <h1 className="text-4xl font-semibold tracking-tight">U&</h1>
        <p className="text-sm text-[#F6EFE9]/60">A quiet place for just the two of you.</p>
      </div>

      {params.error && (
        <p className="text-sm text-[#FF8966]">
          Something went wrong signing you in. Try again.
        </p>
      )}

      <div className="w-full max-w-xs">
        <GoogleSignInButton next={params.next ?? '/'} />
      </div>
    </div>
  );
}
