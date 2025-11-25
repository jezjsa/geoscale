import PlansSelection from '@/components/PlansSelection';

export function PlansPage() {
  return (
    <div className="min-h-screen bg-black py-20">
      <div className="container mx-auto px-4">
        <PlansSelection showHeader={true} />
      </div>
    </div>
  );
}

