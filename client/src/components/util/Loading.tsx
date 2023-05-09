import Spinner from "react-bootstrap/Spinner";
import React from "react";

export default function Loading() {
	return (
		<div className="d-flex justify-content-center align-items-center h-100 w-100">
			<Spinner animation="border" role="status" variant="primary" />
		</div>
	);
}

export function LoadingSmall() {
	return (
		<Spinner
			as={"span"}
			animation="border"
			role="status"
			variant="primary"
			size="sm"
			className="m-1"
		/>
	);
}
