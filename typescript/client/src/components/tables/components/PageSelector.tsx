import { type SetState } from "#types/react";
import { Button } from "react-bootstrap";
import { type integer } from "tachi-common";

export default function PageSelector({
	setPage,
	currentPage,
	maxPage,
}: {
	currentPage: integer;
	maxPage: integer;
	setPage: SetState<integer>;
}) {
	const elipseStart = currentPage > 4 && maxPage > 5;
	const elipseEnd = maxPage - currentPage > 3 && maxPage > 5;

	function PageButton({ page }: { page: integer }) {
		return (
			<Button
				onClick={() => setPage(page)}
				variant={currentPage === page ? "primary" : "base"}
			>
				{page}
			</Button>
		);
	}

	let middleNums;

	if (elipseStart && elipseEnd) {
		middleNums = [currentPage - 1, currentPage, currentPage + 1];
	} else if (elipseStart) {
		middleNums = [maxPage - 4, maxPage - 3, maxPage - 2];
	} else if (elipseEnd) {
		middleNums = [3, 4, 5];
	} else {
		// not enough pages.
		const pageNums = [];
		for (let i = 1; i <= maxPage; i++) {
			pageNums.push(i);
		}

		return (
			<>
				{pageNums.map((e) => (
					<PageButton key={e} page={e} />
				))}
			</>
		);
	}

	return (
		<>
			<PageButton page={1} />
			{elipseStart ? (
				<Button disabled={true} variant="base">
					...
				</Button>
			) : (
				<PageButton page={2} />
			)}
			{middleNums.map((e) => (
				<PageButton key={e} page={e} />
			))}
			{elipseEnd ? (
				<Button disabled={true} variant="base">
					...
				</Button>
			) : (
				<PageButton page={maxPage - 1} />
			)}
			<PageButton page={maxPage} />
		</>
	);
}
