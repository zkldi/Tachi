import deepmerge from "deepmerge";
import { useCallback, useMemo, useRef, useState } from "react";
import { type integer } from "tachi-common";

export type ZTableSortFn<D> = (a: D, b: D) => integer;
export type ZTableSearchFn<D> = (search: string, data: D) => boolean;

interface ZTableOptions<D> {
	pageLen: integer;
	search: string;
	searchFunction: ZTableSearchFn<D>;
	entryName: string;
	defaultSortMode: string | null;
	defaultReverseSort: boolean;
	sortFunctions: Record<string, ZTableSortFn<D>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DefaultOptions: ZTableOptions<any> = {
	pageLen: 10,
	search: "",
	searchFunction: () => true,
	entryName: "entries",
	defaultSortMode: null,
	defaultReverseSort: false,
	sortFunctions: {},
};

export function useZTable<D>(originalDataset: D[], providedOptions?: Partial<ZTableOptions<D>>) {
	// override all default options with any provided ones.
	const options: ZTableOptions<D> = deepmerge(DefaultOptions, providedOptions ?? {});

	const {
		search,
		entryName,
		pageLen: initialPageLen,
		defaultReverseSort,
		searchFunction,
		sortFunctions,
		defaultSortMode,
	} = options;

	const [page, setPage] = useState(1);
	const [pageLen, setPageLen] = useState(initialPageLen);

	// what we're currently sorting on. If null, use natural order.
	const [sortMode, setSortMode] = useState(defaultSortMode);

	// whether we're sorting descendingly or not.
	const [reverseSort, setReverseSort] = useState(defaultReverseSort);

	const prevSearchRef = useRef(search);
	if (search !== prevSearchRef.current) {
		prevSearchRef.current = search;
		// One update with filter changes; bails out when page is already 1 (avoids extra commit on first keystroke).
		setPage(1);
	}

	const dataset = useMemo(() => {
		let mutatedSet = originalDataset;

		if (search !== "") {
			mutatedSet = mutatedSet.filter((v) => searchFunction(search, v));
		}

		if (sortMode !== null) {
			mutatedSet = mutatedSet.slice().sort(sortFunctions[sortMode]);

			if (reverseSort) {
				mutatedSet.reverse();
			}
		}

		return mutatedSet;
	}, [search, originalDataset, sortMode, reverseSort]);

	const maxPage = useMemo(() => Math.ceil(dataset.length / pageLen), [dataset, pageLen]);

	const pageState = useMemo(() => {
		if ((page === maxPage && page === 1) || maxPage === 0) {
			return "start-end";
		} else if (page === maxPage) {
			return "end";
		} else if (page === 1) {
			return "start";
		}

		return "middle";
	}, [page, maxPage, dataset]);

	const displayStr = useMemo(() => {
		if (dataset.length === 0) {
			if (search !== "") {
				return `Displaying no ${entryName}. Your filter might be too narrow.`;
			}

			return `Displaying no ${entryName}.`;
		}

		const filterSuffix = search !== "" ? ` (Filtered from ${originalDataset.length})` : "";

		if (dataset.length <= pageLen) {
			return `Displaying ${dataset.length} ${entryName}${filterSuffix}.`;
		}

		return `Displaying ${(page - 1) * pageLen + 1} to ${Math.min(
			page * pageLen,
			dataset.length,
		)} of ${dataset.length} ${entryName}${filterSuffix}.`;
	}, [page, dataset, pageLen, search, entryName, originalDataset.length]);

	// Create a sliding window that can be used for pagination.
	const pageWindow = useMemo(
		() => dataset.slice((page - 1) * pageLen, page * pageLen),
		[page, dataset, pageLen],
	);

	// simple utilities for previous and next buttons
	const incrementPage = useCallback(() => {
		setPage((p) => p + 1);
	}, []);

	const decrementPage = useCallback(() => {
		setPage((p) => p - 1);
	}, []);

	const setInnerPageLen = (pageLen: number) => {
		setPageLen(pageLen);
		setPage(1);
	};

	// utility for sorting
	const changeSort = useCallback(
		(sort: string) => {
			if (sortMode === sort) {
				setReverseSort((r) => !r);
			} else {
				setSortMode(sort);
				// desc sort is default
				setReverseSort(true);
			}
		},
		[sortMode],
	);

	return {
		pageWindow,
		incrementPage,
		decrementPage,
		pageState,
		page,
		setPage,
		maxPage,
		displayStr,
		sortMode,
		changeSort,
		reverseSort,
		filteredDataset: dataset,
		pageLen,
		setPageLen: setInnerPageLen,
	};
}
