import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import SmallText from "#components/util/SmallText";
import StickyPopover from "#components/util/StickyPopover";
import { RFA } from "#util/misc";
import { GetValueGetter, type SearchFunctions } from "#util/ztable/search";
import React, { useState } from "react";
import { Modal } from "react-bootstrap";

function ExampleQueries({
	keyName: key,
	value,
}: {
	keyName: string;
	value: boolean | number | string | [string, number] | null;
}) {
	if (typeof value === "string") {
		return (
			<>
				<code>
					{key}={value}
				</code>
				.{" "}
				<small className="text-body-secondary" style={{ fontSize: "1rem" }}>
					(You can use <code>==</code> for exact matching)
				</small>
			</>
		);
	} else if (value === null) {
		return <code>{key}=asdf</code>;
	} else if (typeof value === "boolean") {
		return (
			<>
				<code>{key}=yes</code>, <code>{key}=no</code>
			</>
		);
	}

	let v;
	if (Array.isArray(value)) {
		v = value[0];
	} else {
		v = Number.isInteger(value) ? value : value.toFixed(2);
	}

	const randomMathOp = RFA([">", "<", "<=", ">="]);

	return (
		<code>
			{key}
			{randomMathOp}
			{v}
		</code>
	);
}

export default function FilterDirectivesIndicator<D>({
	searchFunctions,
	doc,
}: {
	doc: D;
	searchFunctions: SearchFunctions<D>;
}) {
	const [modalShow, setModalShow] = useState(false);

	return (
		<>
			<StickyPopover
				component={
					<>
						You can use{" "}
						<ExternalLink href="https://docs.tachi.ac/wiki/filter-directives/">
							<strong>Filter Directives</strong>
						</ExternalLink>{" "}
						inside this filter box.
						<Divider className="mt-2 mb-2" />
						You can click this button to view the filter directives for this table.
					</>
				}
				placement="top"
			>
				<small className="input-group-text" onClick={() => setModalShow(true)}>
					<i className="fas fa-bolt" style={{ fontSize: "0.8rem" }} />
				</small>
			</StickyPopover>
			<Modal onHide={() => setModalShow(false)} show={modalShow} size="xl">
				<Modal.Header closeButton>
					<Modal.Title>Table Filters</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<p>
						You can use filters on this table to show just what you care about. The list
						of filters you can use here is shown below!
					</p>
					<Divider className="mb-4" />
					<ul style={{ fontSize: "1.5rem" }}>
						{Object.keys(searchFunctions).map((key) => (
							<li key={key}>
								<ExampleQueries
									keyName={key}
									value={GetValueGetter(searchFunctions[key])(doc)}
								/>
							</li>
						))}
					</ul>
					<Divider className="mb-4" />
					Option List
					<ul>
						<li>
							<code>=</code> (Equal to)
						</li>
						<li>
							<code>==</code> (Text is EXACTLY equal to)
						</li>
						<li>
							<code>&gt;</code>, <code>&lt;</code> (Greater than, Less than)
						</li>
						<li>
							<code>&gt;=</code>, <code>&lt;=</code> (Greater than or equal to, Less
							than or equal to)
						</li>
					</ul>
					<span>
						<small className="text-body-secondary">
							You can <SmallText large="click" small="tap" /> anywhere off this dialog
							to close it.
						</small>
					</span>
				</Modal.Body>
			</Modal>
		</>
	);
}
