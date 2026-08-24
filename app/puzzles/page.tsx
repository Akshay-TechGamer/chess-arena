import type { Metadata } from 'next';
import { PuzzleBoard } from '@/components/PuzzleBoard';

export const metadata: Metadata = {
	title: 'Daily puzzle — Chess Arena',
};

export default function PuzzlesPage() {
	return <PuzzleBoard />;
}
