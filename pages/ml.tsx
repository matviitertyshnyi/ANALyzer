import Layout from '@/components/Layout';
import MLControls from '@/components/MLControls';

export default function MLPage() {
  return (
    <Layout>
      <div className="flex flex-col gap-4 p-4">
        <MLControls />
      </div>
    </Layout>
  );
}
