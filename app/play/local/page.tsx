import type { Metadata } from 'next';
import { GameBoard } from '@/components/GameBoard';

export const metadata: Metadata = {
	title: 'Local game — Chess Arena',
};

export default function LocalGamePage() {
	return <GameBoard mode="local" />;
}
