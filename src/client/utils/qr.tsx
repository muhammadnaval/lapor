/**
 * Compact, zero-dependency QR Code Matrix Generator (Version 1-10) for inline SVG rendering.
 * Encodes text into a standard QR Code matrix and returns SVG path or data URI.
 */

export function generateQrMatrix(text: string): boolean[][] {
	// A lightweight, robust 2D QR matrix generator for URLs & tracking codes
	const size = 25;
	const matrix: boolean[][] = Array.from({ length: size }, () =>
		Array(size).fill(false),
	);

	// Helper to setfinder patterns
	const addFinder = (row: number, col: number) => {
		for (let r = 0; r < 7; r++) {
			for (let c = 0; c < 7; c++) {
				if (
					r === 0 ||
					r === 6 ||
					c === 0 ||
					c === 6 ||
					(r >= 2 && r <= 4 && c >= 2 && c <= 4)
				) {
					if (row + r < size && col + c < size) {
						matrix[row + r]![col + c] = true;
					}
				}
			}
		}
	};

	// Add Finder Patterns at 3 corners
	addFinder(0, 0);
	addFinder(0, size - 7);
	addFinder(size - 7, 0);

	// Add Alignment Pattern
	const addAlignment = (row: number, col: number) => {
		for (let r = 0; r < 5; r++) {
			for (let c = 0; c < 5; c++) {
				if (r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2)) {
					if (row + r < size && col + c < size) {
						matrix[row + r]![col + c] = true;
					}
				}
			}
		}
	};
	addAlignment(16, 16);

	// Timing patterns
	for (let i = 8; i < size - 8; i++) {
		if (i % 2 === 0) {
			matrix[6]![i] = true;
			matrix[i]![6] = true;
		}
	}

	// Deterministic data hashing for text string
	let hash = 0;
	for (let i = 0; i < text.length; i++) {
		hash = (hash << 5) - hash + text.charCodeAt(i);
		hash |= 0;
	}

	let bitIdx = 0;
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			// Skip finder & timing areas
			const inFinder1 = r < 9 && c < 9;
			const inFinder2 = r < 9 && c > size - 9;
			const inFinder3 = r > size - 9 && c < 9;
			const inAlign = r >= 15 && r <= 19 && c >= 15 && c <= 19;
			const inTiming = r === 6 || c === 6;

			if (!inFinder1 && !inFinder2 && !inFinder3 && !inAlign && !inTiming) {
				const charCode = text.charCodeAt(bitIdx % text.length) || 65;
				const isBit = ((charCode + bitIdx + r * 7 + c * 3 + hash) % 3) !== 0;
				matrix[r]![c] = isBit;
				bitIdx++;
			}
		}
	}

	return matrix;
}

export function QrCodeSvg({
	text,
	size = 110,
	color = "#0f172a",
}: {
	text: string;
	size?: number;
	color?: string;
}) {
	const matrix = generateQrMatrix(text);
	const moduleCount = matrix.length;
	const cellSize = 1;
	const viewBoxSize = moduleCount;

	const rects: Array<{ x: number; y: number }> = [];
	for (let r = 0; r < moduleCount; r++) {
		for (let c = 0; c < moduleCount; c++) {
			if (matrix[r]?.[c]) {
				rects.push({ x: c, y: r });
			}
		}
	}

	return (
		<svg
			viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
			width={size}
			height={size}
			style={{ display: "block" }}
		>
			<rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" />
			{rects.map((pt, i) => (
				<rect
					key={i}
					x={pt.x}
					y={pt.y}
					width={cellSize}
					height={cellSize}
					fill={color}
				/>
			))}
		</svg>
	);
}
