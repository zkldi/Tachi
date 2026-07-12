import Icon from "#components/util/Icon";
import Select from "#components/util/Select";
import SmallText from "#components/util/SmallText";
import { useZTable, type ZTableSortFn } from "#components/util/table/useZTable";
import { UserSettingsContext } from "#context/UserSettingsContext";
import { WindowContext } from "#context/WindowContext";
import { CopyToClipboard } from "#util/misc";
import { ComposeSearchFunction, type SearchFunctions } from "#util/ztable/search";
import React, { type Key, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "react-bootstrap";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import { type integer } from "tachi-common";

import FilterDirectivesIndicator from "./FilterDirectivesIndicator";
import NoDataWrapper from "./NoDataWrapper";
import PageSelector from "./PageSelector";
import SortableTH from "./SortableTH";
import tachitableStyles from "./TachiTable.module.scss";

const DEFAULT_TACHI_PAGE_LEN_OPTIONS: integer[] = [10, 25, 50, 100, 1000];

export interface ZTableTHProps {
	changeSort: (str: string) => void;
	currentSortMode: string | null;
	reverseSort: boolean;
}

type NameHeader = [string, string];
type NameSortHeader<D> = [string, string, ZTableSortFn<D> | null];
type ComponentYielderHeader<D> = [
	string,
	string,
	ZTableSortFn<D> | null,
	(thProps: ZTableTHProps) => JSX.Element,
];

// 0: name
// 1: sortFn
// 2: componentYielder -- yeah, i realise this format sucks.
export type Header<D> = ComponentYielderHeader<D> | NameHeader | NameSortHeader<D>;

function GetSortFunctions<D>(headers: Header<D>[]) {
	const sortFunctions: Record<string, ZTableSortFn<D>> = {};

	for (const header of headers) {
		const [name, _shortName, sortFn] = header;

		if (sortFn) {
			sortFunctions[name] = sortFn;
		}
	}

	return sortFunctions;
}

function ParseHeaders<D>(headers: Header<D>[], thProps: ZTableTHProps) {
	const headerElements: JSX.Element[] = [];

	headers.forEach((header, index) => {
		const [name, shortName, sortFn, componentYielder] = header;

		if (componentYielder) {
			headerElements.push(
				<React.Fragment key={index}>{componentYielder(thProps)}</React.Fragment>,
			);
		} else if (sortFn) {
			headerElements.push(
				<SortableTH
					key={`header-${name}`}
					name={name}
					shortName={shortName}
					{...thProps}
				/>,
			);
		} else {
			headerElements.push(
				<th key={`header-${name}`}>
					<span className="d-none d-lg-block">{name}</span>
					<span className="d-block d-lg-none">{shortName}</span>
				</th>,
			);
		}
	});

	return <tr>{headerElements}</tr>;
}

export default function TachiTable<D>({
	dataset,
	rowFunction,
	headers,
	entryName,
	pageLen = 10,
	defaultSortMode,
	defaultReverseSort,
	searchFunctions,
	noTopDisplayStr = false,
	noBottomDisplayPager = false,
	pageLenOptions = DEFAULT_TACHI_PAGE_LEN_OPTIONS,
	rowKey,
	externalSearchPreset = undefined,
}: {
	dataset: D[];
	defaultReverseSort?: boolean;
	defaultSortMode?: string;
	entryName: string;
	/**
	 * When `nonce` changes (desktop breakpoints only), replaces the filter text — e.g.
	 * syncing from folder breakdown → table filter.
	 */
	externalSearchPreset?: { nonce: number; search: string } | null;
	headers: Header<D>[];
	noBottomDisplayPager?: boolean;
	noTopDisplayStr?: boolean;
	pageLen?: integer;
	pageLenOptions?: integer[];
	rowFunction: (data: D) => JSX.Element;
	/** Stable keys for tbody rows (e.g. chartID) so filtering reconciles instead of re-mounting. */
	rowKey?: (row: D) => Key;
	searchFunctions?: SearchFunctions<D>;
}) {
	const [search, setSearch] = useState("");
	const lastExternalNonce = useRef<number | undefined>(undefined);
	const [highlightFilterPulse, setHighlightFilterPulse] = useState(false);

	const searchFunction = useMemo(
		() => (searchFunctions ? ComposeSearchFunction(searchFunctions) : undefined),
		[searchFunctions],
	);

	const sortFunctions = useMemo(() => GetSortFunctions(headers), [headers]);

	const ztable = useZTable(dataset ?? [], {
		search,
		searchFunction,
		sortFunctions,
		entryName,
		pageLen,
		defaultSortMode,
		defaultReverseSort,
	});

	const {
		pageWindow,
		setPage,
		pageState,
		incrementPage,
		decrementPage,
		page,
		maxPage,
		displayStr,
		sortMode,
		reverseSort,
		changeSort,
		filteredDataset,
	} = ztable;

	const headersRow = useMemo(
		() =>
			ParseHeaders(headers, {
				changeSort,
				currentSortMode: sortMode,
				reverseSort,
			}),
		[headers, changeSort, sortMode, reverseSort],
	);

	const { settings } = useContext(UserSettingsContext);
	const {
		breakpoint: { isLg },
	} = useContext(WindowContext);

	const filterChromeClass = useMemo(() => {
		const hasFilterText = search.trim().length > 0;

		return [
			tachitableStyles.filterBarChrome,
			hasFilterText ? tachitableStyles.filterBarChromeActive : "",
			highlightFilterPulse ? tachitableStyles.searchFilterFlash : "",
		]
			.filter(Boolean)
			.join(" ");
	}, [highlightFilterPulse, search]);

	useEffect(() => {
		if (!externalSearchPreset || !isLg) {
			return;
		}

		const { nonce, search: presetSearch } = externalSearchPreset;

		if (lastExternalNonce.current === nonce) {
			return;
		}

		lastExternalNonce.current = nonce;
		setSearch(presetSearch);

		let canceled = false;
		setHighlightFilterPulse(false);

		const raf = window.requestAnimationFrame(() => {
			if (!canceled) {
				setHighlightFilterPulse(true);
			}
		});

		const t = window.setTimeout(() => {
			if (!canceled) {
				setHighlightFilterPulse(false);
			}
		}, 1250);

		return () => {
			canceled = true;
			window.cancelAnimationFrame(raf);
			window.clearTimeout(t);
		};
	}, [externalSearchPreset?.nonce, externalSearchPreset?.search, isLg]);

	return (
		<div>
			<div className="hstack justify-content-between">
				{!noTopDisplayStr && (
					<div className="d-none d-lg-flex align-self-center">{displayStr}</div>
				)}
				{searchFunctions && (
					<div
						className={`ms-lg-auto ${filterChromeClass}`}
						style={{ maxWidth: isLg ? 384 : undefined }}
					>
						<InputGroup>
							<Form.Control
								onChange={(e) => setSearch(e.target.value)}
								placeholder={`Filter ${entryName}`}
								type="text"
								value={search}
							/>
							{dataset[0] && (
								<FilterDirectivesIndicator
									doc={dataset[0]}
									searchFunctions={searchFunctions}
								/>
							)}
						</InputGroup>
					</div>
				)}
			</div>
			<div className="px-0 mt-4 mb-4 overflow-x-auto overflow-x-lg-hidden">
				<table className="table table-striped table-hover table-vertical-center text-center">
					<thead>{headersRow}</thead>
					<tbody>
						<NoDataWrapper>
							{pageWindow.map((e, i) => {
								const fallbackKey = i + ztable.pageLen * (page - 1);
								return (
									<React.Fragment
										key={
											rowKey && e !== null && e !== undefined
												? rowKey(e)
												: fallbackKey
										}
									>
										{e && rowFunction(e)}
									</React.Fragment>
								);
							})}
						</NoDataWrapper>
					</tbody>
				</table>
			</div>
			<div className="row row-gap-4">
				<div className="col-lg-4 d-flex justify-content-center justify-content-lg-start">
					{dataset.length > 10 && !noBottomDisplayPager && (
						<Select
							name={`Show this many ${entryName}:`}
							setValue={(e) => ztable.setPageLen(Number(e))}
							value={ztable.pageLen.toString()}
						>
							{pageLenOptions.map((n) => (
								<option key={n} value={String(n)}>
									{n}
								</option>
							))}
						</Select>
					)}
				</div>
				<div className="d-none d-lg-flex col-lg-4 justify-content-center align-items-center">
					{settings?.preferences.developerMode && (
						<Button
							className="ms-4 w-50"
							onClick={() => {
								let data = dataset;
								if (search !== "") {
									data = filteredDataset;
								}

								CopyToClipboard(data);
							}}
							variant="outline-info"
						>
							<Icon type="table" /> Export {search !== "" ? "Filtered Data" : "Table"}{" "}
							(JSON)
						</Button>
					)}
				</div>
				<div className="col-lg-4 ms-auto d-flex justify-content-center justify-content-lg-end">
					{dataset.length > ztable.pageLen && !noBottomDisplayPager && (
						<div className="btn-group">
							<Button
								disabled={pageState === "start" || pageState === "start-end"}
								onClick={decrementPage}
								variant="secondary"
							>
								<SmallText large="Previous" small="<" />
							</Button>
							<PageSelector currentPage={page} maxPage={maxPage} setPage={setPage} />
							<Button
								disabled={pageState === "end" || pageState === "start-end"}
								onClick={incrementPage}
								variant="secondary"
							>
								<SmallText large="Next" small=">" />
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
