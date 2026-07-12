import { SubheaderContext } from "#context/SubheaderContext";
import React, { useContext } from "react";
import { Container } from "react-bootstrap";

import { type LayoutStyles } from "../Layout";
import { Breadcrumbs } from "./components/Breadcrumbs";

export function SubHeader({ styles }: { styles: LayoutStyles }) {
	const subheader = useContext(SubheaderContext);
	return (
		<>
			<header
				className="bg-body bg-opacity-75"
				id="subheader"
				style={{ marginTop: `${styles.headerHeight}px` }}
			>
				<Container
					className="d-flex flex-column justify-content-center align-items-center align-items-lg-start gap-4"
					style={{ height: styles.backgroundHeight }}
				>
					<h2 className="fw-bold">{subheader.title}</h2>

					<Breadcrumbs items={subheader.breadcrumbs} />
				</Container>
			</header>
		</>
	);
}
