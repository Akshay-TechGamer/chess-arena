import type { Metadata } from 'next';
import { AnalysisBoard } from '@/components/AnalysisBoard';

export const metadata: Metadata = {
	title: 'Analysis — Chess Arena',
};

export default async function AnalyzePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <AnalysisBoard gameID={id} />;
}
