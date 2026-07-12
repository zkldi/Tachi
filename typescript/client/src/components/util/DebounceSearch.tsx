import { type SetState } from "#types/react";
import React, { useLayoutEffect, useState } from "react";
import { type FormControlProps } from "react-bootstrap";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";

import Icon from "./Icon";

export default function DebounceSearch({
	setSearch,
	committedSearch,
	autoFocus = false,
	...props
}: {
	autoFocus?: boolean;
	/** When set, keeps the input in sync when the committed value changes (e.g. from the URL). */
	committedSearch?: string;
	setSearch: SetState<string>;
} & FormControlProps) {
	const [lastTimeout, setLastTimeout] = useState<number | null>(null);
	const [uiSearch, setUISearch] = useState(committedSearch ?? "");

	useLayoutEffect(() => {
		if (committedSearch === undefined) {
			return;
		}
		setUISearch(committedSearch);
	}, [committedSearch]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setUISearch(e.target.value);

		if (lastTimeout !== null) {
			clearTimeout(lastTimeout);
		}

		const closureSearch = e.target.value;

		const handle = window.setTimeout(() => {
			setSearch(closureSearch);
		}, 300);

		setLastTimeout(handle);
	};

	return (
		<InputGroup size="lg">
			<Form.Control
				autoFocus={autoFocus}
				onChange={handleChange}
				type="text"
				value={uiSearch}
				{...props}
			/>
			<InputGroup.Text>
				<Icon type="search" />
			</InputGroup.Text>
		</InputGroup>
	);
}
