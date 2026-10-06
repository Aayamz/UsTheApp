import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import Logo from '@/components/Logo';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-6 px-8 text-center bg-[#1F1324] text-[#F6EFE9]">
      <div className="flex flex-col items-center gap-3">
        <Logo size={64} showWordmark />
        <p className="text-sm text-[#C9B3D1]">A quiet place for just the two of you.</p>
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
