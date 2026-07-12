import { APIFetchV1 } from "#util/api";
import React, { useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";

/**
 * Shown only when the Vite local-dev client talks to a dev server whose Postgres `song`
 * table is empty (seeds were never loaded).
 */
export function LocalDevMissingSeedsBanner() {
	const [show, setShow] = useState(false);

	useEffect(() => {
		if (!import.meta.env.VITE_IS_LOCAL_DEV) {
			return;
		}

		void APIFetchV1<{ missingSongSeeds: boolean }>("/localdev/song-seed-status").then((r) => {
			if (r.success && r.body.missingSongSeeds) {
				setShow(true);
			}
		});
	}, []);

	if (!show) {
		return null;
	}

	return (
		<Alert
			className="position-fixed bottom-0 start-50 translate-middle-x mb-3 mx-3 shadow"
			role="alert"
			style={{ zIndex: 1080, maxWidth: "min(42rem, calc(100vw - 2rem))" }}
			variant="warning"
		>
			There are no seeds in the database. <br />
			Have you forgotten to run <code className="user-select-all">just db-load-seeds</code>?
		</Alert>
	);
}
