import React, { type CSSProperties } from "react";
import Spinner from "react-bootstrap/Spinner";

export default function Loading({ style }: { style?: CSSProperties }) {
	return (
		<div className="d-flex justify-content-center align-items-center w-100" style={style}>
			<Spinner variant="primary" />
		</div>
	);
}
