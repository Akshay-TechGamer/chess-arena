import type { Metadata } from 'next';
import { OnlineGameBoard } from '@/components/OnlineGameBoard';

export const metadata: Metadata = {
	title: 'Online game — Chess Arena',
};

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <OnlineGameBoard gameID={id} />;
}
