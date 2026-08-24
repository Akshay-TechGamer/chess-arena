// Copies the Stockfish engine (lite single-threaded build) from node_modules
// into public/engine/ so the browser can load it as a Web Worker.
// The engine JS hard-codes 'stockfish.wasm' as its binary name, so we rename.
// Runs automatically before `dev` and `build` (see package.json scripts).
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

const files = [
	['stockfish-18-lite-single.js', 'stockfish.js'],
	['stockfish-18-lite-single.wasm', 'stockfish.wasm'],
];

const srcDir = path.resolve('node_modules/stockfish/bin');
const outDir = path.resolve('public/engine');

mkdirSync(outDir, { recursive: true });

for (const [srcName, outName] of files) {
	const src = path.join(srcDir, srcName);
	const out = path.join(outDir, outName);
	if (!existsSync(src)) {
		console.error(`copy-engine: missing ${src} — did npm install run?`);
		process.exit(1);
	}
	if (existsSync(out) && statSync(out).size === statSync(src).size) {
		continue;
	}
	copyFileSync(src, out);
	console.log(`copy-engine: ${srcName} -> public/engine/${outName}`);
}
